const { Schema, model } = require("mongoose");

const dbCache = new Map(), dbSaveQueue = new Map();

const userDomainsObject = {
    userid: "",
    domains: {}
};

const guildSchema = Schema(userDomainsObject, { minimize: true });
const UserDomains = model("UserDomains", guildSchema);
module.exports.UserDomains = UserDomains;
global.UserDomains = UserDomains;

const get = (userid) => new Promise((resolve, reject) => UserDomains.findOne({ userid }, (err, guild) => {
    if (err) return reject(err);
    if (!guild) {
        guild = new UserDomains(userDomainsObject);
        guild.userid = userid;
    };
    return resolve(guild);
}));

const load = async (userid) => {
    const guild = await get(userid), guildCache = {}, freshGuildObject = userDomainsObject;
    for (const key in freshGuildObject) guildCache[key] = guild[key] || freshGuildObject[key];
    return dbCache.set(userid, guildCache);
};

const save = async (userid, changes) => {
    if (!dbSaveQueue.has(userid)) {
        dbSaveQueue.set(userid, changes);
        const guild = await get(userid), guildCache = dbCache.get(userid), guildSaveQueue = JSON.parse(JSON.stringify(dbSaveQueue.get(userid)));
        for (const key of guildSaveQueue) guild[key] = guildCache[key];
        return guild.save().then(() => {
            let newSaveQueue = dbSaveQueue.get(userid);
            if (newSaveQueue.length > guildSaveQueue.length) {
                dbSaveQueue.delete(userid);
                save(userid, newSaveQueue.filter(key => !guildSaveQueue.includes(key)));
            } else dbSaveQueue.delete(userid);
        }).catch(console.log);
    } else dbSaveQueue.get(userid).push(...changes);
};

module.exports = () => (async (userid) => {
    if (!dbCache.has(userid)) await load(userid);
    return {
        reload: () => load(userid),
        unload: () => dbCache.delete(userid),

        get: () => Object.assign({}, dbCache.get(userid)),
        set: (key, value) => {
            dbCache.get(userid)[key] = value;
            save(userid, [key]);

            return dbCache.get(userid);
        },
        setMultiple: (changes) => {
            let guildCache = dbCache.get(userid);
            Object.assign(guildCache, changes);

            save(userid, Object.keys(changes));

            return dbCache.get(userid);
        },
        addToArray: (array, value) => {
            dbCache.get(userid)[array].push(value);
            save(userid, [array]);

            return dbCache.get(userid);
        },
        removeFromArray: (array, value) => {
            dbCache.get(userid)[array] = dbCache.get(userid)[array].filter(aValue => aValue !== value);
            save(userid, [array]);

            return dbCache.get(userid);
        },
        setOnObject: (object, key, value) => {
            dbCache.get(userid)[object][key] = value;
            save(userid, [object]);

            return dbCache.get(userid);
        },
        removeFromObject: (object, key) => {
            delete dbCache.get(userid)[object][key];
            save(userid, [object]);

            return dbCache.get(userid);
        },
        reset: () => {
            let guildCache = dbCache.get(userid);
            Object.assign(guildCache, userDomainsObject);
            guildCache.userid = userid;

            save(userid, Object.keys(userDomainsObject));

            return dbCache.get(userid);
        }
    };
});

module.exports.cacheAll = async (users = new Set()) => {
    let gdbs = await UserDomains.find({ $or: [...users].map((userid) => ({ userid })) });
    return await Promise.all([...users].map(async (userid) => {
        const guild = gdbs.find((db) => db.userid == userid) || { userid };
        const guildCache = {};
        const freshGuildObject = userDomainsObject;

        for (const key in freshGuildObject) guildCache[key] = guild[key] || freshGuildObject[key];

        return dbCache.set(userid, guildCache);
    }));
};