module.exports = {
    name: "ping",
    description: "Bot latency and uptime.",
    permissionRequired: 0,
    slash: true
};

const { CommandInteraction } = require("discord.js");
const { msToTime } = require("../constants/");

module.exports.run = async (interaction = new CommandInteraction) => {
    const uptime = msToTime(interaction.client.uptime);
    const api = Math.ceil(interaction.client.ws.ping);
    const server = Date.now() - interaction.createdTimestamp;

    return await interaction.reply(`🏓 Server latency \`${server}ms\`, API latency \`${api}ms\` and bot uptime is \`${uptime}\`.`);
};