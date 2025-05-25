require('dotenv').config();

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require("express");
const commands = require('./commands');

// --- Importe la DB et la fonction removeAccents ---
const pictosDB = require('./pictosDB');
function removeAccents(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// --- Définition des slash commands ---
const slashCommands = [
    new SlashCommandBuilder()
        .setName('pictos')
        .setDescription('Recherche un picto par nom')
        .addStringOption(option =>
            option.setName('nom')
                .setDescription('Nom du picto à rechercher')
                .setRequired(true)
                .setAutocomplete(true)) // Ajoute cette ligne
        ,
    new SlashCommandBuilder()
        .setName('zone')
        .setDescription('Recherche les pictos d\'une zone')
        .addStringOption(option =>
            option.setName('zone')
                .setDescription('Nom de la zone')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('totalcost')
        .setDescription('Affiche le coût total de tous les pictos'),
    new SlashCommandBuilder()
        .setName('number')
        .setDescription('Affiche le nombre total de pictos'),
].map(cmd => cmd.toJSON());

// --- Enregistrement des slash commands ---
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Enregistrement des slash commands (global)...');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: slashCommands }
        );
        console.log('Slash commands globales enregistrées !');

        // Enregistrement pour un serveur spécifique (guild)
        if (process.env.GUILD_ID) {
            console.log('Enregistrement des slash commands (guild)...');
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: slashCommands }
            );
            console.log('Slash commands guild enregistrées !');
        }
    } catch (error) {
        console.error(error);
    }
})();

// --- Gestion des interactions ---
client.on('ready', () => {
    console.log(`Bot connecté en tant que ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'ping') {
        await interaction.reply('Pong!');
    }
    else if (interaction.commandName === 'echo') {
        const msg = interaction.options.getString('message');
        await interaction.reply(msg);
    }
    else if (interaction.commandName === 'pictos') {
        const search = removeAccents(interaction.options.getString('nom').toLowerCase());
        const results = pictosDB.filter(pic =>
            removeAccents(pic.name.toLowerCase()).includes(search)
        );
        if (results.length === 0) {
            await interaction.reply({ content: `Aucun picto trouvé pour "${search}".`, ephemeral: true });
        } else {
            const embed = new EmbedBuilder()
                .setTitle(`Résultats pour "${search}"`)
                .setColor(0x0099ff)
                .setDescription(results.slice(0, 5).map(pic =>
                    `**${pic.name}**\n${pic.description}\nCoût : ${pic.cost}\nLieu : ${pic.location}`
                ).join('\n\n'));
            await interaction.reply({ embeds: [embed] });
        }
    }
    else if (interaction.commandName === 'zone') {
        const search = removeAccents(interaction.options.getString('zone').toLowerCase());
        const results = pictosDB.filter(pic =>
            removeAccents((pic.location || '').toLowerCase()).includes(search)
        );
        if (results.length === 0) {
            await interaction.reply({ content: `Aucun picto trouvé pour la zone "${interaction.options.getString('zone')}".`, ephemeral: true });
        } else {
            const embed = new EmbedBuilder()
                .setTitle(`Pictos pour la zone "${interaction.options.getString('zone')}"`)
                .setColor(0x00cc99)
                .setDescription(results.slice(0, 10).map(pic =>
                    `**${pic.name}**\n${pic.description}\nCoût : ${pic.cost}\nLieu : ${pic.location}`
                ).join('\n\n'));
            await interaction.reply({ embeds: [embed] });
        }
    }
    else if (interaction.commandName === 'totalcost') {
        const total = pictosDB.reduce((sum, pic) => sum + (parseInt(pic.cost) || 0), 0);
        const embed = new EmbedBuilder()
            .setTitle('Coût total des pictos')
            .setColor(0xff9900)
            .setDescription(`Le coût total de tous les pictos est : **${total}**`);
        await interaction.reply({ embeds: [embed] });
    }
    else if (interaction.commandName === 'number') {
        const count = pictosDB.length;
        const embed = new EmbedBuilder()
            .setTitle('Nombre total de pictos')
            .setColor(0x3366ff)
            .setDescription(`Il y a **${count}** pictos au total.`);
        await interaction.reply({ embeds: [embed] });
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isAutocomplete()) return;
    if (interaction.commandName === 'pictos') {
        const focusedValue = removeAccents(interaction.options.getFocused().toLowerCase());
        const choices = pictosDB
            .map(pic => pic.name)
            .filter(name =>
                removeAccents(name.toLowerCase()).includes(focusedValue)
            )
            .slice(0, 25); // Discord limite à 25 suggestions
        await interaction.respond(
            choices.map(choice => ({ name: choice, value: choice }))
        );
    }
});

client.login(process.env.DISCORD_TOKEN);

// --- Express keep-alive ---
const app = express();
app.get("/", (req, res) => {
  res.send("Bot is alive!");
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Keep-alive server running on port ${PORT}`);
});
