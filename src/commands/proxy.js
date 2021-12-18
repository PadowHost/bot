module.exports = {
    name: "proxy",
    description: "s",
    opts: [{
        type: 3,
        name: "domain",
        description: "aaa",
        required: true
    }, {
        type: 3,
        name: "target",
        description: "aaa",
        required: true
    }, {
        type: 6,
        name: "user",
        description: "aaa",
        required: true
    }],
    permissionRequired: 4,
    slash: true
};

const { ssh } = require("../../config");
const { Client } = require("ssh2");
const { CommandInteraction } = require("discord.js");
const db = require("../database/index")();

module.exports.run = async (interaction) => {
    if (!(interaction instanceof CommandInteraction)) return;
    const udb = await db.userdomains(interaction.options.getUser("user").id);
    const udbs = await Promise.all(interaction.client.users.cache.map(async (u) => await db.userdomains(u.id).then((d) => d.get())));

    const toProxy = interaction.options.getString("domain").toLowerCase().trim();
    const target = interaction.options.getString("target").toLowerCase().trim();
    if (udbs.filter((a) => Object.keys(a?.domains).includes(toProxy)).length) return interaction.reply("Domain is already linked");

    let m = await interaction.reply({ content: "Please give me a few seconds! \nProcess: Connecting to SSH...", fetchReply: true });

    let conn = new Client();
    conn.connect({
        host: ssh.host,
        port: ssh.port,
        username: ssh.user,
        password: ssh.password
    });

    conn.on("ready", () => {
        m.edit("Please give me a few seconds! \nProcess: SSH connected. \nNext: Making SSL cert... **This will take a few seconds**");
        conn.exec("sudo certbot certonly --apache -n --keep --redirect --agree-tos --email me@djoh.xyz -d" + toProxy, (err, stream) => {
            if (err) return console.log(err);
            stream.on("close", () => { }).on("data", (data) => {
                console.log(data.toString());
                if (data.toString().includes("Congratulations!")) {
                    m.edit([
                        "Please give me a few seconds!",
                        "Process: SSL Complete.",
                        "Next: Write proxy file. **Sometimes this gets stuck, If it takes more than 10seconds run the command again**"
                    ].join("\n"));
                    conn.exec(`echo "<VirtualHost *:80>
    ServerName ${toProxy}
    RewriteEngine On
    RewriteCond %{HTTPS} !=on
    RewriteRule ^/?(.*) https://%{SERVER_NAME}/$1 [R,L] 
</VirtualHost>
<VirtualHost *:443>
    ServerName ${toProxy}
    ProxyRequests off
    SSLProxyEngine on
    ProxyPreserveHost On
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/${toProxy}/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/${toProxy}/privkey.pem

    <Location />
        ProxyPass http://${target}/
        ProxyPassReverse http://${target}/
    </Location>
</VirtualHost>" > /etc/apache2/sites-enabled/${toProxy}.conf && sleep 1 && echo "complete"`, (err, stream) => {
                        if (!!err) throw err;
                        stream.on("close", () => { }).on("data", () => {
                            m.edit("Please give me a few seconds! \nProcess: Proxy file written. \nNext: Reload webserver.");
                            setTimeout(() => {
                                conn.exec("sudo systemctl restart apache2 && echo \"complete\"", (err, stream) => {
                                    if (err) throw err;
                                    stream.on("close", () => { }).on("data", () => {
                                        m.edit("Domain linking complete!");
                                        udb.setOnObject("domains", toProxy, target);
                                        conn.end();
                                    });
                                });
                            }, 2000);
                        });
                    });
                } else if (data.includes("Certificate not yet due for renewal")) {
                    m.edit([
                        "Please give me a few seconds!",
                        "Process: SSL Complete.",
                        "Next: Write proxy file. **Sometimes this gets stuck, If it takes more than 10seconds run the command again**"
                    ].join("\n"));
                    conn.exec(`echo  "<VirtualHost *:80>
    ServerName ${toProxy}
    RewriteEngine On
    RewriteCond %{HTTPS} !=on
    RewriteRule ^/?(.*) https://%{SERVER_NAME}/$1 [R,L] 
</VirtualHost>
<VirtualHost *:443>
    ServerName ${toProxy}
    ProxyRequests off
    SSLProxyEngine on
    ProxyPreserveHost On
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/${toProxy}/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/${toProxy}/privkey.pem

    <Location />
        ProxyPass http://${target}/
        ProxyPassReverse http://${target}/
    </Location>
</VirtualHost>" > /etc/apache2/sites-enabled/${toProxy}.conf && sleep 1 && echo "complete"`, (err, stream) => {
                        if (!!err) throw err;
                        stream.on("close", () => { }).on("data", () => {
                            m.edit("Please give me a few seconds! \nProcess: Proxy file written. \nNext: Reload webserver.");
                            setTimeout(() => {
                                conn.exec("sudo systemctl restart apache2 && echo \"complete\"", (err, stream) => {
                                    if (err) throw err;
                                    stream.on("close", () => { }).on("data", () => {
                                        m.edit("Domain linking complete!");
                                        udb.setOnObject("domains", toProxy, target);
                                        conn.end();
                                    });
                                });
                            }, 2000);
                        });
                    });
                } else {
                    m.edit(`ERROR, SSL failed to connect. Is your domain pointing to the correct ip address?\nReverse Proxy ip is: \`${ssh.host}\``);
                };
            });
        });
    });
};