// index.js
import express from 'express';
import { Client, GatewayIntentBits, Partials, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionsBitField, REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.get('/', (req, res) => res.send('Bot is live!'));
app.listen(3000, () => console.log('🌐 Web server (порт 3000) активовано для Render'));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

const ADMIN_IDS = ['845277573654380555', '1054470308112900126'];
const APPLICATION_CHANNEL_ID = '1390301425984081960';
const SUPPORT_CHANNEL_ID = '1390325195935584296';

client.once('ready', () => {
  console.log(`🔗 Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

  if (interaction.isChatInputCommand() && interaction.commandName === 'ticketsetup') {
    const userId = interaction.user.id;
    if (!ADMIN_IDS.includes(userId)) {
      await interaction.reply({ content: '❌ Лише адміністратори можуть використовувати цю команду.', ephemeral: true });
      return;
    }

    const appChannel = client.channels.cache.get(APPLICATION_CHANNEL_ID);
    const supportChannel = client.channels.cache.get(SUPPORT_CHANNEL_ID);

    if (!appChannel || !supportChannel) {
      await interaction.reply({ content: '❌ Один або обидва канали не знайдено', ephemeral: true });
      return;
    }

    const applicationEmbed = new EmbedBuilder()
      .setTitle('Як зайти?')
      .setDescription(`Подайте **заявку** кнопкою нижче, щоб поринути в світ моду **Create** на **SunRise:Create**\nЗаявки роздивляються до **24 годин**`)
      .setImage('https://cdn.discordapp.com/attachments/1390316873450782793/1391775926559441016/i-made-a-traction-town-in-minecraft-using-the-create-mod-v0-wgf62t5li2sc1_2.png')
      .setFooter({ text: 'SunRise:Create • Поринь у світ моду Create!' })
      .setColor(0xE0A000);

    const applicationButton = new ButtonBuilder()
      .setCustomId('create_application_ticket')
      .setLabel('📩 Подати заявку!')
      .setStyle(ButtonStyle.Primary);

    await appChannel.send({ embeds: [applicationEmbed], components: [new ActionRowBuilder().addComponents(applicationButton)] });

    const supportEmbed = new EmbedBuilder()
      .setTitle('Підтримка')
      .setDescription(`Нажміть на кнопку нижче, щоб отримати **допомогу** від адміністрації серверу **SunRise:Create**\nВідповідь буде надіслана в межах **24 годин**`)
      .setImage('https://cdn.discordapp.com/attachments/1390316873450782793/1390336690303930378/2023-08-30_15.20.02.png')
      .setFooter({ text: 'SunRise:Create • Завжди раді допомогти!' })
      .setColor(0x00B38F);

    const supportButton = new ButtonBuilder()
      .setCustomId('create_support_ticket')
      .setLabel('📨 Створити тікет!')
      .setStyle(ButtonStyle.Success);

    await supportChannel.send({ embeds: [supportEmbed], components: [new ActionRowBuilder().addComponents(supportButton)] });

    await interaction.reply({ content: '✅ Повідомлення для заявки та підтримки надіслано', ephemeral: true });
  }

  if (interaction.isButton()) {
    const guild = interaction.guild;
    if (!guild) return;

    const username = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/gi, '');

    const existingChannel = guild.channels.cache.find(c =>
      c.name === `заявка-${username}` || c.name === `підтримка-${username}`
    );

    if (existingChannel) {
      await interaction.reply({ content: '❌ У вас вже є відкритий тікет або заявка.', ephemeral: true });
      return;
    }

    let channelName, title;

    if (interaction.customId === 'create_application_ticket') {
      channelName = `заявка-${username}`;
      title = 'Ваша заявка створена!';
    } else if (interaction.customId === 'create_support_ticket') {
      channelName = `підтримка-${username}`;
      title = 'Ваш тікет підтримки створено!';
    } else {
      return;
    }

    const newChannel = await guild.channels.create({
      name: channelName,
      type: 0,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        },
        ...ADMIN_IDS.map(id => ({
          id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        }))
      ]
    });

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription('Очікуйте відповіді адміністрації.')
      .setColor(0x00B38F);

    const closeButton = new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('Закрити')
      .setStyle(ButtonStyle.Danger);

    await newChannel.send({
      content: `<@${interaction.user.id}>`,
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(closeButton)]
    });

    await interaction.reply({ content: `✅ Канал створено: ${newChannel}`, ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId === 'close_ticket') {
    if (!ADMIN_IDS.includes(interaction.user.id)) {
      await interaction.reply({ content: '❌ Ви не маєте прав закривати цей тікет.', ephemeral: true });
      return;
    }

    await interaction.reply({ content: 'Тікет буде закрито через 3 секунди...', ephemeral: true });
    setTimeout(() => interaction.channel?.delete().catch(() => null), 3000);
  }
});

const commands = [
  new SlashCommandBuilder()
    .setName('ticketsetup')
    .setDescription('Надіслати повідомлення для створення тікетів')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
(async () => {
  try {
    console.log('🔄 Реєстрація команд...');
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('✅ Команди зареєстровано');
  } catch (error) {
    console.error('❌ Помилка реєстрації команд:', error);
  }
})();

client.login(process.env.DISCORD_TOKEN);
