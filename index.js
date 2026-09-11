const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// Guarda quem convidou cada membro
const invitesCache = new Map();

// Guarda os dados dos convidados
const inviteData = new Map();

async function carregarConvites(guild) {
  const invites = await guild.invites.fetch();

  const mapa = new Map();

  invites.forEach(invite => {
    mapa.set(invite.code, invite.uses);
  });

  invitesCache.set(guild.id, mapa);
}

// Quando o bot ligar
client.once("ready", async () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);

  for (const guild of client.guilds.cache.values()) {
    try {
      await carregarConvites(guild);
    } catch (error) {
      console.log(`❌ Não consegui carregar convites de ${guild.name}`);
    }
  }

  console.log("📊 Sistema de convites iniciado!");
});

// Quando alguém entra
client.on("guildMemberAdd", async member => {
  try {
    const guild = member.guild;

    const antes = invitesCache.get(guild.id) || new Map();
    const atuais = await guild.invites.fetch();

    let conviteUsado = null;

    atuais.forEach(invite => {
      const usosAntes = antes.get(invite.code) || 0;

      if (invite.uses > usosAntes) {
        conviteUsado = invite;
      }
    });

    // Atualiza o cache
    const novoMapa = new Map();

    atuais.forEach(invite => {
      novoMapa.set(invite.code, invite.uses);
    });

    invitesCache.set(guild.id, novoMapa);

    if (!conviteUsado || !conviteUsado.inviter) {
      console.log(`⚠️ Não consegui identificar quem convidou ${member.user.tag}`);
      return;
    }

    const convidador = conviteUsado.inviter.id;

    if (!inviteData.has(convidador)) {
      inviteData.set(convidador, {
        convidados: new Map()
      });
    }

    const dados = inviteData.get(convidador);

    dados.convidados.set(member.id, {
      entrou: true,
      saiu: false
    });

    console.log(
      `📥 ${member.user.tag} entrou através de ${conviteUsado.inviter.tag}`
    );

  } catch (error) {
    console.error("Erro ao detectar entrada:", error);
  }
});

// Quando alguém sai
client.on("guildMemberRemove", async member => {
  try {
    for (const [convidador, dados] of inviteData.entries()) {

      if (dados.convidados.has(member.id)) {
        const convidado = dados.convidados.get(member.id);

        convidado.saiu = true;
        convidado.entrou = false;

        console.log(
          `📤 ${member.user.tag} saiu. Convidado por ${convidador}`
        );

        break;
      }
    }
  } catch (error) {
    console.error("Erro ao detectar saída:", error);
  }
});

// Comando /convite
const comando = new SlashCommandBuilder()
  .setName("convite")
  .setDescription("Mostra as estatísticas de convites de um usuário")
  .addUserOption(option =>
    option
      .setName("usuario")
      .setDescription("Usuário que deseja consultar")
      .setRequired(true)
  );

client.once("ready", async () => {
  try {
    const rest = new REST({ version: "10" })
      .setToken(process.env.DISCORD_TOKEN);

    await rest.put(
      Routes.applicationCommands(client.user.id),
      {
        body: [comando.toJSON()]
      }
    );

    console.log("✅ Comando /convite registrado!");
  } catch (error) {
    console.error("Erro ao registrar comando:", error);
  }
});

// Resposta do comando
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName !== "convite") return;

  const usuario = interaction.options.getUser("usuario");

  const dados = inviteData.get(usuario.id);

  if (!dados) {
    return interaction.reply({
      content: `📊 **Convites de ${usuario}**\n\n👥 Total convidados: **0**\n🟢 Ficaram: **0**\n🔴 Saíram: **0**\n📈 Retenção: **0%**`,
      ephemeral: false
    });
  }

  const convidados = dados.convidados;

  const total = convidados.size;

  let ficaram = 0;
  let sairam = 0;

  convidados.forEach(dadosConvidado => {
    if (dadosConvidado.saiu) {
      sairam++;
    } else {
      ficaram++;
    }
  });

  const retencao =
    total > 0
      ? Math.round((ficaram / total) * 100)
      : 0;

  await interaction.reply({
    content:
      `📊 **Convites de ${usuario}**\n\n` +
      `👥 Total convidados: **${total}**\n` +
      `🟢 Ficaram: **${ficaram}**\n` +
      `🔴 Saíram: **${sairam}**\n\n` +
      `📈 Retenção: **${retencao}%**`
  });
});

// Login
client.login(process.env.DISCORD_TOKEN);
