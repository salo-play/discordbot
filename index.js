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

dotenv.config();

// ================== CLIENT ==================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

// ================== CONFIG ==================

const ADMIN_IDS = ['845277573654380555', '1054470308112900126'];
const APPLICATION_CATEGORY_ID = '1466868416014192781';

const RCON_CONFIG = {
  host: 'remote-pattern.gl.joinmc.link',
  port: 25575,
  password: process.env.RCON_PASSWORD
};

// ================== READY ==================

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ================== INTERACTIONS ==================

client.on('interactionCreate', async interaction => {

  // ---------- SLASH /ticketsetup ----------
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'ticketsetup') {

      const embed = new EmbedBuilder()
        .setTitle('📩 Подати заявку')
        .setColor(0xe29549)
        .setDescription(
          'Натисніть кнопку нижче, щоб створити заявку на сервер **Cognia**.\n\n' +
          '⚠️ **Одна заявка на користувача**'
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('create_application_ticket')
          .setLabel('➕ Створити заявку')
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.reply({
        embeds: [embed],
        components: [row]
      });

      return;
    }
  }

  // ---------- BUTTONS ----------
  if (interaction.isButton()) {

    // CREATE APPLICATION
    if (interaction.customId === 'create_application_ticket') {
      const modal = new ModalBuilder()
        .setCustomId('application_form')
        .setTitle('Заявка на сервер Cognia');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('mc_nick')
            .setLabel('Minecraft нік')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('age')
            .setLabel('Вік')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('secret')
            .setLabel('Секретне слово з правил')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('how_know')
            .setLabel('Як дізнались про проект?')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        )
      );

      await interaction.showModal(modal);
      return;
    }

    // ACCEPT
    if (interaction.customId.startsWith('accept_application_')) {
      if (!ADMIN_IDS.includes(interaction.user.id)) {
        return interaction.reply({ content: '❌ Тільки адміністрація.', ephemeral: true });
      }

      const mcNick = interaction.channel.topic?.split('MC_NICK:')[1];
      if (!mcNick) {
        return interaction.reply({ content: '⚠️ MC нік не знайдено.', ephemeral: true });
      }

      try {
        const rcon = await Rcon.connect(RCON_CONFIG);
        await rcon.send(`whitelist add ${mcNick}`);
        await rcon.end();

        await interaction.reply(`✅ **${mcNick}** додано в whitelist`);
      } catch {
        return interaction.reply('❌ Помилка RCON');
      }

      setTimeout(() => interaction.channel.delete().catch(() => {}), 5 * 60 * 1000);
    }

    // DENY
    if (interaction.customId.startsWith('deny_application_')) {
      if (!ADMIN_IDS.includes(interaction.user.id)) {
        return interaction.reply({ content: '❌ Тільки адміністрація.', ephemeral: true });
      }

      await interaction.reply('❌ Заявку відхилено. Канал буде видалено через 5 хв.');
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5 * 60 * 1000);
    }
  }

  // ---------- MODAL SUBMIT ----------
  if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'application_form') {

    const guild = interaction.guild;
    if (!guild) return;

    const mcNick = interaction.fields.getTextInputValue('mc_nick').trim();
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(mcNick)) {
      return interaction.reply({ content: '❌ Невірний Minecraft-нік', ephemeral: true });
    }

    const username = interaction.user.username.replace(/[^a-zA-Z0-9]/g, '-');
    if (guild.channels.cache.find(c => c.name === `заявка-${username}`)) {
      return interaction.reply({ content: '❌ У вас вже є заявка.', ephemeral: true });
    }

    const overwrites = [
      { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
    ];

    for (const adminId of ADMIN_IDS) {
      overwrites.push({
        id: adminId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
      });
    }

    const channel = await guild.channels.create({
      name: `заявка-${username}`,
      type: ChannelType.GuildText,
      parent: APPLICATION_CATEGORY_ID,
      topic: `MC_NICK:${mcNick}`,
      permissionOverwrites: overwrites
    });

    const embed = new EmbedBuilder()
      .setTitle('📨 Нова заявка')
      .setColor(0xe29549)
      .setDescription(
        `**Minecraft нік:** ${mcNick}\n` +
        `**Вік:** ${interaction.fields.getTextInputValue('age')}\n` +
        `**Секретне слово:** ${interaction.fields.getTextInputValue('secret')}\n` +
        `**Як дізнались:** ${interaction.fields.getTextInputValue('how_know')}`
      );

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`accept_application_${interaction.user.id}`)
        .setLabel('✅ Прийняти')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`deny_application_${interaction.user.id}`)
        .setLabel('❌ Відхилити')
        .setStyle(ButtonStyle.Danger)
    );

    await channel.send({
      content: `<@${interaction.user.id}>`,
      embeds: [embed],
      components: [buttons]
    });

    await interaction.reply({ content: '✅ Заявка створена!', ephemeral: true });
  }
});

// ================== SLASH REGISTER ==================

const commands = [
  new SlashCommandBuilder()
    .setName('ticketsetup')
    .setDescription('Надіслати ембед створення заявки')
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

await rest.put(
  Routes.applicationCommands(process.env.CLIENT_ID),
  { body: commands }
);

// ================== EXPRESS ==================

const app = express();
app.get('/', (_, res) => res.send('Bot alive'));
app.listen(3000);

// ================== LOGIN ==================

client.login(process.env.DISCORD_TOKEN);
