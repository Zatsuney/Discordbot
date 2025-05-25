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
    // --- Autocomplétion ---
    if (interaction.isAutocomplete()) {
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
        return; // On arrête ici pour ne pas traiter comme une commande normale
    }

    // --- Slash commands ---
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
            await sendPaginatedEmbeds(interaction, results, `Résultats pour "${search}"`, 0x0099ff);
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
            await sendPaginatedEmbeds(interaction, results, `Pictos pour la zone "${interaction.options.getString('zone')}"`, 0x00cc99);
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

async function sendPaginatedEmbeds(interaction, results, title, color) {
    const perPage = 5;
    let page = 0;
    const totalPages = Math.ceil(results.length / perPage);

    function getEmbed(page) {
        return new EmbedBuilder()
            .setTitle(`${title} (page ${page + 1}/${totalPages})`)
            .setColor(color)
            .setDescription(
                results.slice(page * perPage, (page + 1) * perPage)
                    .map(pic =>
                        `**${pic.name}**\n${pic.description}\nCoût : ${pic.cost}\nLieu : ${pic.location}`
                    ).join('\n\n')
            );
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('prev')
            .setLabel('⬅️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === 0),
        new ButtonBuilder()
            .setCustomId('next')
            .setLabel('➡️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === totalPages - 1)
    );

    const reply = await interaction.reply({
        embeds: [getEmbed(page)],
        components: totalPages > 1 ? [row] : [],
        fetchReply: true
    });

    if (totalPages <= 1) return;

    const collector = reply.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
            await i.reply({ content: "Tu ne peux pas utiliser ces boutons.", ephemeral: true });
            return;
        }
        if (i.customId === 'prev' && page > 0) page--;
        if (i.customId === 'next' && page < totalPages - 1) page++;

        const newRow = ActionRowBuilder.from(row);
        newRow.components[0].setDisabled(page === 0);
        newRow.components[1].setDisabled(page === totalPages - 1);

        await i.update({
            embeds: [getEmbed(page)],
            components: [newRow]
        });
    });

    collector.on('end', async () => {
        if (reply.editable) {
            await reply.edit({ components: [] });
        }
    });
}

// --- Express keep-alive ---
const app = express();
app.get("/", (req, res) => {
  res.send("Bot is alive!");
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Keep-alive server running on port ${PORT}`);
});

client.login(process.env.DISCORD_TOKEN);
