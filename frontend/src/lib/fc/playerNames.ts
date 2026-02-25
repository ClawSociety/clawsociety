export type Tier = 'bronze' | 'silver' | 'gold' | 'diamond';

export const PLAYER_NAMES: Record<Tier, string[]> = {
  bronze: [
    "Peladeiro", "Bolinha", "Canela", "Pe-Torto", "Gordinho",
    "Tropeçao", "Chuteira", "Pipoquinha", "Ze Firula", "Panela",
    "Cabeçao", "Perneta", "Cotovelada", "Canelinha", "Fumaça",
    "Sem-Noçao", "Bola Murcha", "Ze Ninguem", "Pe-de-Chumbo", "Meiuca",
    "Trombada", "Carretilha", "Lambreta", "Chaleira", "Piao",
    "Bizonho", "Catimba", "Cai-Cai", "Fominha", "Retranca",
    "Mala", "Pereba", "Perninha", "Brocador", "Mulambo",
    "Chinelinho", "Garrancho", "Zambeta", "Pitoco", "Canhao Torto",
    "Zagueirão", "Toquinho", "Borrachinha", "Pedalada", "Carrininho",
    "Travessao", "Chapeleiro", "Goleiro Julio", "Gandula", "Impedido",
  ],
  silver: [
    "Neymarco", "Messinho", "Mbapzinho", "Ronaldim", "Haalandao",
    "Saladinha", "Modrique", "Benzinho", "De Bruinho", "Viniquinho",
    "Krossinho", "Bellingao", "Szczesny Jr", "Courtinho", "Ter Stegen Jr",
    "Alisson Jr", "Van Dijkinho", "Rubenao", "Saka Jr", "Foden Jr",
    "Rashinho", "Grizinho", "Lewandinho", "Kangole", "Toni Grosso",
    "Pedrilho", "Gavilao", "Rodrigolito", "Younginho", "Hakimzinho",
    "Tchouameninho", "Dembulezinho", "Raphao", "Antonyão", "Lisandrinho",
    "Camavingolito", "Joséluzinho", "Araujo Jr", "Kounde Jr", "Gundogolito",
    "Julianinho", "Dioguinho", "Osimhenzinho", "Thiaguinho", "Jorgolito",
    "Chielsinho", "Barellinha", "Bastolinho", "Militonzinho", "Carvajolito",
  ],
  gold: [
    "Pelezinho", "Zidaniel", "Ronaldonico", "Beckhammer", "Cruyffinho",
    "Maradonaldo", "Platinaldo", "Eusebiao", "Puskazinho", "Di Stefao",
    "Matthäuzinho", "Baresialdo", "Maldinheiro", "Xavizao", "Iniestao",
    "Riberynho", "Robbenzao", "Buffonaldo", "Neuerao", "Schweinao",
    "Lampardao", "Gerrarudo", "Pirulinho", "Kante Jr", "Pogbaldo",
    "Raulsinho", "Shearer Jr", "Henry Jr", "Bergkampinho", "Drogbao",
    "Vieiraldo", "Scholezinho", "Giggolinho", "Tottinho", "Del Pierinho",
    "Nedinaldo", "Shevchenkinho", "Kakazao", "Ibrazinho", "Suarezito",
    "Nesta Jr", "Cannavarinho", "Puyolao", "Vidiquinho", "Ferdinandao",
    "Casillazinho", "Zoffaldo", "Bankzinho", "Yashinaldo", "Campeao",
  ],
  diamond: [
    "O Fenomeno", "El Diez", "Il Capitano", "Der Kaiser", "Le Roi",
    "The GOAT", "O Bruxo", "El Pibe", "Il Divino", "O Monstro",
    "La Pulga", "El Matador", "O Alienigena", "Le Professeur", "El Loco",
    "The Phantom", "O Imperador", "El Magico", "Il Genio", "Der Bomber",
    "O Cometa", "La Bestia", "El Elegante", "The Legend", "O Abençoado",
    "Le Magnifique", "Der Panzer", "Il Maestro", "O Redentor", "El Santo",
    "The Flash", "O Imortal", "La Furia", "El Titan", "Der Konig",
    "Il Gladiatore", "O Furacão", "Le Sorcier", "El Demonio", "The Chosen",
    "O Predador", "La Leyenda", "Der Adler", "Il Campione", "The Warden",
    "O Relampago", "El Supremo", "Le Champion", "Der Meister", "The One",
  ],
};

export function playerTier(avgStat: number): Tier {
  if (avgStat >= 80) return 'diamond';
  if (avgStat >= 65) return 'gold';
  if (avgStat >= 45) return 'silver';
  return 'bronze';
}

export function playerName(tokenId: number, tier: Tier): string {
  const names = PLAYER_NAMES[tier];
  return names[tokenId % names.length];
}

export function cardImageUrl(tokenId: number, tier: Tier): string {
  const index = tokenId % 50;
  return `/fc-cards/${tier}/${index}.png`;
}

export const TIER_COLORS: Record<Tier, { border: string; glow: string; text: string; bg: string }> = {
  bronze: {
    border: '#CD7F32',
    glow: 'rgba(205,127,50,0.4)',
    text: '#CD7F32',
    bg: 'rgba(205,127,50,0.1)',
  },
  silver: {
    border: '#C0C0C0',
    glow: 'rgba(192,192,192,0.4)',
    text: '#C0C0C0',
    bg: 'rgba(192,192,192,0.1)',
  },
  gold: {
    border: '#FFD700',
    glow: 'rgba(255,215,0,0.5)',
    text: '#FFD700',
    bg: 'rgba(255,215,0,0.1)',
  },
  diamond: {
    border: '#B9F2FF',
    glow: 'rgba(185,242,255,0.6)',
    text: '#B9F2FF',
    bg: 'rgba(185,242,255,0.15)',
  },
};

export const TIER_LABELS: Record<Tier, string> = {
  bronze: 'BRONZE',
  silver: 'SILVER',
  gold: 'GOLD',
  diamond: 'DIAMOND',
};

export const TIER_STARS: Record<Tier, string> = {
  bronze: '\u2605',
  silver: '\u2605\u2605',
  gold: '\u2605\u2605\u2605',
  diamond: '\u2605\u2605\u2605\u2605',
};
