const { GuildMember } = require("discord.js");
const config = require("../../config");

module.exports = Object.assign(
    require("./resolvers"),
    require("./time")
);

module.exports.getPermissionLevel = (member = new GuildMember) => {
    if (!(member instanceof GuildMember)) return 0;

    if (config.admins[0] == member.user.id) return 5; // bot owner
    if (config.admins.includes(member.user.id)) return 4; // bot admin
    if (member.guild.ownerId == member.user.id) return 3; // server owner
    if (member.permissions.has("MANAGE_GUILD")) return 2; // server admin
    return 0; // server member
};