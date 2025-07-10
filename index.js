import {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder
} from 'discord.js';
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
const ACCEPT_ROLE_ID = '1390325276159770786';

client.once('ready', () => {
  console.log(`🔗 Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

  // /ticketsetup
  if (interaction.isChatInputCommand() && interaction.commandName === 'ticketsetup') {
    if (!ADMIN_IDS.includes(interaction.user.id)) {
      return interaction.reply({ content: '❌ Тільки адміністрація.', ephemeral: true });
    }

    const appChannel = client.channels.cache.get(APPLICATION_CHANNEL_ID);
    const supportChannel = client.channels.cache.get(SUPPORT_CHANNEL_ID);

    if (!appChannel || !supportChannel) {
      return interaction.reply({ content: '❌ Канали не знайдено.', ephemeral: true });
    }

    const applicationEmbed = new EmbedBuilder()
      .setTitle('Як зайти?')
      .setDescription(`Подайте **заявку**, щоб потрапити на сервер **Cognia**\nВідповідь протягом **24 годин**`)
      .setImage('https://cdn.discordapp.com/attachments/1390316873450782793/1391775926559441016/i-made-a-traction-town-in-minecraft-using-the-create-mod-v0-wgf62t5li2sc1_2.png')
      .setFooter({ text: 'Cognia • Поринь у світ моду Create!' })
      .setColor(0xe29549);

    const applicationButton = new ButtonBuilder()
      .setCustomId('create_application_ticket')
      .setLabel('📩 Подати заявку!')
      .setStyle(ButtonStyle.Primary);

    const supportEmbed = new EmbedBuilder()
      .setTitle('Підтримка')
      .setDescription(`Натисніть, щоб звернутись до адміністрації.\nВідповідь протягом **24 годин**`)
      .setImage('https://cdn.discordapp.com/attachments/1390316873450782793/1390336690303930378/2023-08-30_15.20.02.png')
      .setFooter({ text: 'Cognia • Підтримка' })
      .setColor(0xe29549);

    const supportButton = new ButtonBuilder()
      .setCustomId('create_support_ticket')
      .setLabel('📨 Створити тікет!')
      .setStyle(ButtonStyle.Success);

    await appChannel.send({
      embeds: [applicationEmbed],
      components: [new ActionRowBuilder().addComponents(applicationButton)]
    });

    await supportChannel.send({
      embeds: [supportEmbed],
      components: [new ActionRowBuilder().addComponents(supportButton)]
    });

    await interaction.reply({ content: '✅ Повідомлення надіслано', ephemeral: true });
  }

  // Кнопки Прийняти/Відхилити
  if (interaction.isButton()) {
    const guild = interaction.guild;
    if (!guild) return;

    if (interaction.customId.startsWith('accept_application_')) {
      if (!ADMIN_IDS.includes(interaction.user.id)) {
        return interaction.reply({ content: '❌ Тільки адміністрація.', ephemeral: true });
      }

      const memberId = interaction.customId.split('_').pop();
      const member = await guild.members.fetch(memberId).catch(() => null);

      if (!member) {
        return interaction.reply({ content: '⚠️ Користувача не знайдено.', ephemeral: true });
      }

      await member.roles.add(ACCEPT_ROLE_ID).catch(console.error);
      await interaction.reply({ content: `✅ Заявка <@${memberId}> прийнята. Гарної вам гри!`, ephemeral: false });
      return;
    }

    if (interaction.customId.startsWith('deny_application_')) {
      if (!ADMIN_IDS.includes(interaction.user.id)) {
        return interaction.reply({ content: '❌ Тільки адміністрація.', ephemeral: true });
      }

      await interaction.reply({ content: '❌ Заявка відхилена. Канал закриється.', ephemeral: false });
      setTimeout(() => {
        interaction.channel?.delete().catch(console.error);
      }, 5000);
      return;
    }

    if (interaction.customId === 'close_ticket') {
      await interaction.reply({ content: '✅ Тікет буде закрито через 5 сек.', ephemeral: true });
      setTimeout(() => {
        interaction.channel?.delete().catch(console.error);
      }, 5000);
      return;
    }

    // Створення тікету
    const isApp = interaction.customId === 'create_application_ticket';
    const username = interaction.user.username.replace(/[^a-zA-Z0-9]/g, '-');
    const existing = guild.channels.cache.find(c =>
      c.name === (isApp ? `заявка-${username}` : `підтримка-${username}`)
    );

    if (existing) {
      return interaction.reply({ content: `❌ У вас вже є відкритий/а ${isApp ? 'заявка' : 'тікет'}.`, ephemeral: true });
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
        const admin = await guild.members.fetch(adminId);
        overwrites.push({
          id: admin.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        });
      } catch (err) {
        console.warn(`⚠️ Не вдалося завантажити адміна ${adminId}`);
      }
    }

    const channel = await guild.channels.create({
      name: `${isApp ? 'заявка' : 'підтримка'}-${username}`,
      type: 0,
      permissionOverwrites: overwrites
    });

    if (isApp) {
      const embed = new EmbedBuilder()
        .setTitle('✅ Заявку створено')
        .setDescription("Форма подачі заявки:\n\nНікнейм\nВік\nСекретне слово з правил\n\nОчікуйте відповіді адміністратора.\nТільки адміністратор може прийняти або відхилити заявку.")
        .setImage('https://cdn.discordapp.com/attachments/1390316873450782793/1391911325155987466/c8132ccdaa6f629620ac954d6c9296f7_1.png?ex=686d9df0&is=686c4c70&hm=1df433562f4afa2faf89e78fa51255452c2b4a98ca446b81b831722733cd6085&')
        .setColor(0xe29549)
        .setFooter({ text: 'Cognia • Поринь у світ моду Create!' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`accept_application_${interaction.user.id}`)
          .setLabel('✅ Прийняти')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`deny_application_${interaction.user.id}`)
          .setLabel('❌ Відхилити')
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });
    } else {
      const embed = new EmbedBuilder()
        .setTitle('🔧 Підтримка')
        .setDescription('Опишіть вашу проблему нижче.\n⚠️ Будь ласка, не закривайте тікет')
        .setImage('https://cdn.discordapp.com/attachments/1390316873450782793/1390336690303930378/2023-08-30_15.20.02.png')
        .setColor(0xe29549)
        .setFooter({ text: 'Cognia • Підтримка' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel("❌ Закрити (Видалити)")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });
    }

    await interaction.reply({ content: `✅ ${isApp ? 'Заявка' : 'Тікет'} створено: ${channel}`, ephemeral: true });
  }
});

// Slash команда
const commands = [
  new SlashCommandBuilder()
    .setName('ticketsetup')
    .setDescription('Надіслати кнопки заявок/підтримки')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
(async () => {
  try {
    console.log('🔄 Реєстрація команд...');
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('✅ Команди зареєстровано');
  } catch (err) {
    console.error('❌ Помилка реєстрації команд:', err);
  }
})();

// Express для Render
const app = express();
app.get('/', (req, res) => res.send('Bot is live!'));
app.listen(3000, () => console.log('🌐 Web server активний'));

client.login(process.env.DISCORD_TOKEN);

import fetch from 'node-fetch';

// Пінг себе кожні 5 хвилин
setInterval(() => {
  fetch('https://discordbot-kmzu.onrender.com')
    .then(() => console.log('📶 KeepAlive ping sent'))
    .catch(err => console.warn('⚠️ KeepAlive error', err));
}, 5 * 60 * 1000);
