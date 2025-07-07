// ticket_bot/index.js
import { Client, GatewayIntentBits, Partials, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionsBitField, REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';
import express from 'express';
dotenv.config();

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

    const applicationRow = new ActionRowBuilder().addComponents(applicationButton);

    await appChannel.send({
      embeds: [applicationEmbed],
      components: [applicationRow]
    });

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

    const supportRow = new ActionRowBuilder().addComponents(supportButton);

    await supportChannel.send({
      embeds: [supportEmbed],
      components: [supportRow]
    });

    await interaction.reply({ content: '✅ Повідомлення для заявки та підтримки надіслано', ephemeral: true });
  }

  if (interaction.isButton()) {
    const guild = interaction.guild;
    if (!guild) return;

    const username = interaction.user.username.replace(/[^a-zA-Z0-9]/g, '-');
    const isApp = interaction.customId === 'create_application_ticket';
    const typeName = isApp ? 'заявка' : 'підтримка';
    const existing = guild.channels.cache.find(c => c.name === `${typeName}-${username}`);
    if (existing) {
      await interaction.reply({ content: `❌ У вас вже є відкритий ${typeName}.`, ephemeral: true });
      return;
    }

    const overwrites = [
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
      }
    ];

    for (const adminId of ADMIN_IDS) {
      try {
        const member = await guild.members.fetch(adminId);
        overwrites.push({
          id: member.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        });
      } catch {
        console.warn(`⚠️ Не вдалося завантажити адміна з ID ${adminId}`);
      }
    }

    const channel = await guild.channels.create({
      name: `${typeName}-${username}`,
      type: 0,
      permissionOverwrites: overwrites
    });

    const embed = new EmbedBuilder()
      .setTitle(`${typeName.charAt(0).toUpperCase() + typeName.slice(1)} створено`)
      .setDescription('Якщо питання вирішено, натисніть кнопку нижче для закриття.')
      .setColor(0xff0000);

    const button = new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('❌ Закрити')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(button);

    await channel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });
    await interaction.reply({ content: `✅ ${typeName.charAt(0).toUpperCase() + typeName.slice(1)} створено: ${channel}`, ephemeral: true });
  }
});

const commands = [
  new SlashCommandBuilder()
    .setName('ticketsetup')
    .setDescription('Надіслати повідомлення для створення тікетів')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
(async () => {
  try {
    console.log('🔄 Реєстрація команд...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('✅ Команди зареєстровано');
  } catch (error) {
    console.error('❌ Помилка реєстрації команд:', error);
  }
})();

// express для Render
const app = express();
app.get('/', (req, res) => res.send('Bot is live!'));
app.listen(3000, () => console.log('🌐 Web server (порт 3000) активовано для Render'));

client.login(process.env.DISCORD_TOKEN);
