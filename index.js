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
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  InteractionType,
  ChannelType
} from 'discord.js';
import dotenv from 'dotenv';
import express from 'express';
import { Rcon } from 'rcon-client';
import fetch from 'node-fetch';

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
const APPLICATION_CATEGORY_ID = '1466868416014192781';

// RCON налаштування
const RCON_CONFIG = {
  host: 'IP_СЕРВЕРА', // постав свій IP
  port: 25575,
  password: process.env.RCON_PASSWORD
};

client.once('ready', () => {
  console.log(`🔗 Logged in as ${client.user.tag}`);
});

// Обробка кнопок та модалок
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton() && !interaction.isModalSubmit()) return;

  // --------------------
  // Кнопка подати заявку
  // --------------------
  if (interaction.isButton() && interaction.customId === 'create_application_ticket') {
    const modal = new ModalBuilder()
      .setCustomId('application_form')
      .setTitle('Форма заявки на сервер Cognia');

    const ageInput = new TextInputBuilder()
      .setCustomId('age')
      .setLabel('Вік')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const secretInput = new TextInputBuilder()
      .setCustomId('secret')
      .setLabel('Секретне слово з правил')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const knowInput = new TextInputBuilder()
      .setCustomId('how_know')
      .setLabel('Як дізнались про проект?')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(ageInput),
      new ActionRowBuilder().addComponents(secretInput),
      new ActionRowBuilder().addComponents(knowInput)
    );

    return interaction.showModal(modal);
  }

  // --------------------
  // Заповнена форма заявки
  // --------------------
  if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'application_form') {
    const guild = interaction.guild;
    if (!guild) return;

    const username = interaction.user.username.replace(/[^a-zA-Z0-9]/g, '-');
    const existing = guild.channels.cache.find(c => c.name === `заявка-${username}`);
    if (existing) return interaction.reply({ content: '❌ У вас вже є заявка.', ephemeral: true });

    const overwrites = [
      { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
    ];
    for (const adminId of ADMIN_IDS) {
      try {
        const admin = await guild.members.fetch(adminId);
        overwrites.push({ id: admin.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] });
      } catch {}
    }

    const channel = await guild.channels.create({
      name: `заявка-${username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: overwrites
    });

    const embed = new EmbedBuilder()
      .setTitle('✅ Заявка створена')
      .setDescription(
        `Вік: ${interaction.fields.getTextInputValue('age')}\n` +
        `Секретне слово: ${interaction.fields.getTextInputValue('secret')}\n` +
        `Як дізнались про проект: ${interaction.fields.getTextInputValue('how_know')}`
      )
      .setColor(0xe29549)
      .setFooter({ text: 'Cognia • Подано на розгляд' });

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
    await interaction.reply({ content: '✅ Заявка створена!', ephemeral: true });
  }

  // --------------------
  // Прийняття заявки
  // --------------------
  if (interaction.isButton() && interaction.customId.startsWith('accept_application_')) {
    if (!ADMIN_IDS.includes(interaction.user.id)) return interaction.reply({ content: '❌ Тільки адміністрація.', ephemeral: true });

    const memberId = interaction.customId.split('_').pop();
    const member = await interaction.guild.members.fetch(memberId).catch(() => null);
    if (!member) return interaction.reply({ content: '⚠️ Користувача не знайдено.', ephemeral: true });

    await member.roles.add(ACCEPT_ROLE_ID).catch(console.error);
    await interaction.reply({ content: `✅ Заявка <@${memberId}> прийнята!`, ephemeral: false });

    // Перемістити канал у категорію
    if (interaction.channel && APPLICATION_CATEGORY_ID) {
      await interaction.channel.setParent(APPLICATION_CATEGORY_ID).catch(console.error);
    }

    // Додати в Minecraft whitelist через RCON
    try {
      const rcon = await Rcon.connect(RCON_CONFIG);
      const mcName = member.user.username; // можеш змінити на інший нік з форми, якщо треба
      await rcon.send(`whitelist add ${mcName}`);
      await rcon.end();
      await interaction.channel.send(`✅ <@${memberId}> доданий у вайтліст сервера!`);
    } catch (err) {
      console.error('❌ Не вдалося додати в whitelist:', err);
      await interaction.channel.send('⚠️ Сталася помилка при додаванні в whitelist!');
    }

    // Автоматичне видалення каналу через 5 хв
    setTimeout(() => {
      interaction.channel?.delete().catch(console.error);
    }, 5 * 60 * 1000);
  }

  // --------------------
  // Відхилення заявки
  // --------------------
  if (interaction.isButton() && interaction.customId.startsWith('deny_application_')) {
    if (!ADMIN_IDS.includes(interaction.user.id)) return interaction.reply({ content: '❌ Тільки адміністрація.', ephemeral: true });

    await interaction.reply({ content: '❌ Заявка відхилена. Канал буде видалено через 5 хв.', ephemeral: false });
    setTimeout(() => {
      interaction.channel?.delete().catch(console.error);
    }, 5 * 60 * 1000);
  }
});

// --------------------
// Slash команда ticketsetup
// --------------------
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

// --------------------
// Express для Render
// --------------------
const app = express();
app.get('/', (req, res) => res.send('Bot is live!'));
app.listen(3000, () => console.log('🌐 Web server активний'));

// --------------------
// Логін бота
// --------------------
client.login(process.env.DISCORD_TOKEN);

// --------------------
// KeepAlive на Render
// --------------------
setInterval(() => {
  fetch('https://discordbot-kmzu.onrender.com')
    .then(() => console.log('📶 KeepAlive ping sent'))
    .catch(err => console.warn('⚠️ KeepAlive error', err));
}, 5 * 60 * 1000);
