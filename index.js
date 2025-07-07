import './keep_alive.js';
// ticket_bot/index.js
import { Client, GatewayIntentBits, Partials, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionsBitField, REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';
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
      .setImage('https://cdn.discordapp.com/attachments/1390316873450782793/1391775926559441016/i-made-a-traction-town-in-minecraft-using-the-create-mod-v0-wgf62t5li2sc1_2.png?ex=686d1fd6&is=686bce56&hm=f97cddf259dbe6a684d254246e6adc19fdaaee51a85fcfacfd67d17f07e67cd7&')
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
      .setImage('https://cdn.discordapp.com/attachments/1390316873450782793/1390336690303930378/2023-08-30_15.20.02.png?ex=686c80b2&is=686b2f32&hm=115ddf706ef7b1fef272a8ed73b4b8b40097291042ff9a8bb543439295d81ad9&')
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

  // ... решта коду без змін ...
});

// решта коду нижче залишилась незмінною
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

client.login(process.env.DISCORD_TOKEN);
