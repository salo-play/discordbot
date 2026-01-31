import {
  Client,
  GatewayIntentBits,
  Partials,
  SlashCommandBuilder,
  Routes,
  REST,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ChannelType
} from 'discord.js';

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const STAFF_ROLE_ID = 'PUT_STAFF_ROLE_ID_HERE';
const TICKET_CATEGORY_ID = 'PUT_CATEGORY_ID_HERE';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ],
  partials: [Partials.Channel]
});

/* ================= SLASH COMMAND REGISTER ================= */

const commands = [
  new SlashCommandBuilder()
    .setName('ticketsetup')
    .setDescription('Надіслати панель створення заявки')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON()
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

await rest.put(
  Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
  { body: commands }
);

/* ================= READY ================= */

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

/* ================= INTERACTIONS ================= */

client.on('interactionCreate', async interaction => {
  try {

    /* ---------- /ticketsetup ---------- */
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName !== 'ticketsetup') return;

      const embed = new EmbedBuilder()
        .setTitle('📩 Подати заявку')
        .setDescription(
          'Натисніть кнопку нижче, щоб створити заявку на сервер **Cognia**.\n\n' +
          '⚠️ **Одна заявка на користувача**'
        )
        .setColor(0xe2a23d);

      const button = new ButtonBuilder()
        .setCustomId('ticket_create')
        .setLabel('Створити заявку')
        .setStyle(ButtonStyle.Primary);

      await interaction.reply({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(button)]
      });
    }

    /* ---------- BUTTON ---------- */
    if (interaction.isButton()) {
      if (interaction.customId !== 'ticket_create') return;

      const modal = new ModalBuilder()
        .setCustomId('ticket_modal')
        .setTitle('Заявка');

      const name = new TextInputBuilder()
        .setCustomId('name')
        .setLabel('Ваше імʼя')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const reason = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('Причина заявки')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(name),
        new ActionRowBuilder().addComponents(reason)
      );

      await interaction.showModal(modal);
    }

    /* ---------- MODAL SUBMIT ---------- */
    if (interaction.isModalSubmit()) {
      if (interaction.customId !== 'ticket_modal') return;

      await interaction.deferReply({ ephemeral: true });

      const name = interaction.fields.getTextInputValue('name');
      const reason = interaction.fields.getTextInputValue('reason');

      const channel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: TICKET_CATEGORY_ID,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages
            ]
          },
          {
            id: STAFF_ROLE_ID,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages
            ]
          }
        ]
      });

      const ticketEmbed = new EmbedBuilder()
        .setTitle('🎫 Нова заявка')
        .addFields(
          { name: 'Користувач', value: `<@${interaction.user.id}>` },
          { name: 'Імʼя', value: name },
          { name: 'Причина', value: reason }
        )
        .setColor(0x2ecc71);

      await channel.send({ embeds: [ticketEmbed] });

      await interaction.editReply({
        content: `✅ Заявку створено: ${channel}`
      });
    }

  } catch (err) {
    console.error(err);
    if (interaction.isRepliable()) {
      try {
        await interaction.reply({
          content: '❌ Сталася помилка',
          ephemeral: true
        });
      } catch {}
    }
  }
});

/* ================= LOGIN ================= */

client.login(TOKEN);
