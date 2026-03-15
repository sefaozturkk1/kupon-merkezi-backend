const homeTeam = "Sivas";
const awayTeam = "Umraniye";

const m = {
  homeTeam: { name: "Sivasspor" },
  awayTeam: { name: "Ümraniyespor" }
};

const awayName = (m.awayTeam?.name || '').toLowerCase();
const homeName = (m.homeTeam?.name || '').toLowerCase();

console.log("homeName:", homeName);
console.log("homeTeam.toLowerCase():", homeTeam.toLowerCase());
console.log("includes?", homeName.includes(homeTeam.toLowerCase()));

const matchFound = awayName.includes(awayTeam.toLowerCase()) || homeName.includes(homeTeam.toLowerCase());
console.log("matchFound:", matchFound);
