// Posiciones en las que se juega cada campeón (Data Dragon solo trae su clase, no su rol).
// Incluye las posiciones habituales en partidas clasificatorias y competitivas; un campeón puede tener varias.
// Los campeones nuevos que aún no estén aquí se asignan por su clase (ver rolesFor).
export const LANES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;
export type Lane = (typeof LANES)[number];

const T = "TOP", J = "JUNGLE", M = "MIDDLE", B = "BOTTOM", S = "UTILITY";

const ROLES: Record<string, Lane[]> = {
  Aatrox: [T], Ahri: [M], Akali: [M, T], Akshan: [M, T], Alistar: [S], Ambessa: [T, J], Amumu: [J, S], Anivia: [M], Annie: [M, S],
  Aphelios: [B], Ashe: [B, S], AurelionSol: [M], Aurora: [M, T], Azir: [M], Bard: [S], Belveth: [J], Blitzcrank: [S], Brand: [S, J, M],
  Braum: [S], Briar: [J], Caitlyn: [B], Camille: [T, S], Cassiopeia: [M, T], Chogath: [T, M], Corki: [M, B], Darius: [T], Diana: [J, M],
  Draven: [B], DrMundo: [T, J], Ekko: [J, M], Elise: [J, S], Evelynn: [J], Ezreal: [B], Fiddlesticks: [J, S], Fiora: [T], Fizz: [M],
  Galio: [M, S], Gangplank: [T], Garen: [T], Gnar: [T], Gragas: [J, T, S], Graves: [J], Gwen: [T, J], Hecarim: [J], Heimerdinger: [M, T, S],
  Hwei: [M, S], Illaoi: [T], Irelia: [T, M], Ivern: [J], Janna: [S], JarvanIV: [J], Jax: [T, J], Jayce: [T, M], Jhin: [B], Jinx: [B],
  Kaisa: [B], Kalista: [B], Karma: [S, M, T], Karthus: [J, M], Kassadin: [M], Katarina: [M], Kayle: [T, M], Kayn: [J], Kennen: [T],
  Khazix: [J], Kindred: [J], Kled: [T], KogMaw: [B], KSante: [T], Leblanc: [M], LeeSin: [J], Leona: [S], Lillia: [J, T], Lissandra: [M],
  Locke: [J, M], Lucian: [B, M], Lulu: [S], Lux: [S, M], Malphite: [T, S], Malzahar: [M], Maokai: [S, J, T], MasterYi: [J], Mel: [M, S],
  Milio: [S], MissFortune: [B], MonkeyKing: [J, T], Mordekaiser: [T], Morgana: [S, J], Naafiri: [M], Nami: [S], Nasus: [T],
  Nautilus: [S], Neeko: [M, S], Nidalee: [J], Nilah: [B], Nocturne: [J], Nunu: [J], Olaf: [T, J], Orianna: [M], Ornn: [T],
  Pantheon: [T, S, J], Poppy: [J, S, T], Pyke: [S], Qiyana: [J, M], Quinn: [T], Rakan: [S], Rammus: [J], RekSai: [J], Rell: [S, J],
  Renata: [S], Renekton: [T], Rengar: [J, T], Riven: [T], Rumble: [T, M], Ryze: [M, T], Samira: [B], Sejuani: [J], Senna: [S, B],
  Seraphine: [S, B, M], Sett: [T, S], Shaco: [J, S], Shen: [T, S], Shyvana: [J], Singed: [T], Sion: [T], Sivir: [B], Skarner: [J, T],
  Smolder: [B, M], Sona: [S], Soraka: [S], Swain: [S, M, B], Sylas: [M, J], Syndra: [M], TahmKench: [T, S], Taliyah: [J, M], Talon: [M, J],
  Taric: [S], Teemo: [T], Thresh: [S], Tristana: [B, M], Trundle: [J, T], Tryndamere: [T], TwistedFate: [M], Twitch: [B, J],
  Udyr: [J, T], Urgot: [T], Varus: [B, M], Vayne: [B, T], Veigar: [M, B], Velkoz: [S, M], Vex: [M], Vi: [J], Viego: [J], Viktor: [M],
  Vladimir: [M, T], Volibear: [T, J], Warwick: [J, T], Xayah: [B], Xerath: [S, M], XinZhao: [J], Yasuo: [M, T, B], Yone: [M, T],
  Yorick: [T], Yunara: [B], Yuumi: [S], Zaahen: [T, J], Zac: [J], Zed: [M, J], Zeri: [B], Ziggs: [B, M], Zilean: [S, M], Zoe: [M],
  Zyra: [S, J],
};

const BY_CLASS: Record<string, Lane> = { Marksman: B, Support: S, Mage: M, Assassin: M, Fighter: T, Tank: T };

/** Posiciones de un campeón; si no está en la tabla, la de su clase principal en Data Dragon. */
export function rolesFor(id: string, tags: string[]): Lane[] {
  return ROLES[id] ?? [BY_CLASS[tags[0]] ?? M];
}
