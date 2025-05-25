const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const eventHandlers = {
    messageCreate: (message) => {
        if (!message.author.bot) {
            // Handle message creation event
            console.log(`Message from ${message.author.username}: ${message.content}`);
        }
    },
    guildMemberAdd: (member) => {
        // Handle new member joining event
        console.log(`New member joined: ${member.user.username}`);
    }
};

module.exports = (client) => {
    client.on('messageCreate', eventHandlers.messageCreate);
    client.on('guildMemberAdd', eventHandlers.guildMemberAdd);
};