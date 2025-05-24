// Script à lancer une seule fois pour générer pictosDB à partir d'un fichier texte
const fs = require('fs');

const input = fs.readFileSync('pictos.txt', 'utf-8');
const lines = input.split('\n').filter(Boolean);

const pictos = lines.map(line => {
    // Découpe chaque ligne sur une tabulation ou plusieurs espaces
    const parts = line.split(/\t| {2,}/);
    // Si la ligne n'a pas 4 parties, essaie avec un split sur tabulation
    if (parts.length < 4) {
        const tabParts = line.split('\t');
        return {
            name: tabParts[0]?.trim() || "",
            description: tabParts[1]?.trim() || "",
            cost: tabParts[2]?.trim() || "",
            location: tabParts[3]?.trim() || ""
        };
    }
    return {
        name: parts[0].trim(),
        description: parts[1].trim(),
        cost: parts[2].trim(),
        location: parts[3].trim()
    };
});

console.log('const pictosDB = [');
pictos.forEach(pic => {
    console.log(`    { name: "${pic.name.replace(/"/g, '\\"')}", description: "${pic.description.replace(/"/g, '\\"')}", cost: "${pic.cost}", location: "${pic.location}" },`);
});
console.log('];');