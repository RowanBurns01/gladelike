// Gladelike - A simple roguelike game using rot.js

// Constants
const TILE_SIZE = 32; // Size of each tile in pixels
const MAP_WIDTH = 80;  // Actual map width
const MAP_HEIGHT = 50; // Actual map height
const FOV_RADIUS = 6; // How far the player can see

// Game class
class GladelikeGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Viewport dimensions (in tiles)
        this.viewportWidth = 0;
        this.viewportHeight = 0;
        
        // Initialize canvas size based on window
        this.resizeCanvas();
        
        // Camera position (in tile coordinates)
        this.camera = {
            x: 0,
            y: 0
        };
        
        // Set up player character, NPCs, and monsters
        this.player = null;
        this.npcs = [];
        this.monsters = [];
        
        // Player stats
        this.maxHealth = 100;
        this.currentHealth = 100;
        this.playerDamage = [5, 10]; // Min-max damage
        
        // FOV and map memory
        this.visibleTiles = {};
        this.exploredTiles = {};
        
        // Dungeon depth tracking
        this.currentLevel = 1;
        
        // Track resource loading
        this.resourcesLoaded = 0;
        this.totalResources = 3; // tiles.png, rogues.png, and monsters.png
        
        // Add basic monster stats
        this.monsterStats = {
            'goblin': { health: 20, damage: [2, 5] },
            'giantRat': { health: 15, damage: [1, 4] },
            'smallMyconid': { health: 12, damage: [1, 3] },
            'orc': { health: 30, damage: [3, 7] },
            'goblinArcher': { health: 20, damage: [2, 6] },
            'giantSpider': { health: 25, damage: [2, 6] },
            'largeMyconid': { health: 25, damage: [2, 5] },
            'orcBlademaster': { health: 40, damage: [4, 8] },
            'orcWizard': { health: 25, damage: [3, 8] },
            'skeleton': { health: 30, damage: [3, 6] },
            'ghoul': { health: 35, damage: [3, 7] }
        };
        
        // Initialize tiles
        this.tilesetImage = new Image();
        this.tilesetImage.src = 'tiles.png';
        this.tilesetImage.onload = () => {
            this.tilesetLoaded = true;
            this.resourcesLoaded++;
            this.checkAllResourcesLoaded();
        };
        
        // Initialize character sprites
        this.roguesImage = new Image();
        this.roguesImage.src = 'rogues.png';
        this.roguesImage.onload = () => {
            this.roguesLoaded = true;
            this.resourcesLoaded++;
            this.checkAllResourcesLoaded();
        };

        // Initialize monster sprites
        this.monstersImage = new Image();
        this.monstersImage.src = 'monsters.png';
        this.monstersImage.onload = () => {
            this.monstersLoaded = true;
            this.resourcesLoaded++;
            this.checkAllResourcesLoaded();
        };
        
        // Define tile types and character types
        this.defineTileTypes();
        this.defineCharacterTypes();
        this.defineMonsterTypes();
        
        // Set up keyboard handlers
        this.setupKeyboardHandlers();
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.updateCamera();
            this.drawMap();
        });
    }
    
    resizeCanvas() {
        // Adjust canvas to fill the game container
        const container = document.getElementById('game-container');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        
        // Calculate how many tiles fit in the viewport
        this.viewportWidth = Math.ceil(this.canvas.width / TILE_SIZE);
        this.viewportHeight = Math.ceil(this.canvas.height / TILE_SIZE);
        
        // Ensure we recalculate camera position after resize
        if (this.player) {
            this.updateCamera();
        }
    }
    
    checkAllResourcesLoaded() {
        if (this.resourcesLoaded === this.totalResources) {
            this.generateMap();
            this.placeCharacters();
            this.placeMonsters();
            this.computeFOV();
            this.updateCamera();
            this.drawMap();
            this.updateUI();
        }
    }
    
    updateCamera() {
        // Center the camera on the player
        if (!this.player) return;
        
        // Calculate ideal camera position (centered on player)
        this.camera.x = Math.floor(this.player.x - this.viewportWidth / 2);
        this.camera.y = Math.floor(this.player.y - this.viewportHeight / 2);
        
        // Clamp camera to map boundaries
        this.camera.x = Math.max(0, Math.min(this.camera.x, MAP_WIDTH - this.viewportWidth));
        this.camera.y = Math.max(0, Math.min(this.camera.y, MAP_HEIGHT - this.viewportHeight));
    }
    
    setupKeyboardHandlers() {
        // Track pressed keys
        const keys = {};
        
        // Key down event
        window.addEventListener('keydown', (e) => {
            if (!this.player) return;
            
            // Store key state
            keys[e.key] = true;
            
            // Process movement based on key combinations
            this.processMovement(keys);
        });
        
        // Key up event
        window.addEventListener('keyup', (e) => {
            // Remove key from pressed keys
            keys[e.key] = false;
        });
    }
    
    processMovement(keys) {
        if (!this.player) return;
        
        let dx = 0;
        let dy = 0;
        
        // Calculate direction based on arrow keys
        if (keys['ArrowUp']) dy -= 1;
        if (keys['ArrowDown']) dy += 1;
        if (keys['ArrowLeft']) dx -= 1;
        if (keys['ArrowRight']) dx += 1;
        
        // If no movement, return
        if (dx === 0 && dy === 0) return;
        
        const newX = this.player.x + dx;
        const newY = this.player.y + dy;
        
        // Check for combat
        const monster = this.monsters.find(m => m.x === newX && m.y === newY);
        if (monster) {
            // Player attacks monster
            const playerDamage = this.performAttack(
                { damage: this.playerDamage },
                monster
            );
            
            // Monster counter-attack if still alive
            if (monster.health > 0) {
                // Small delay before counter-attack for better visual feedback
                setTimeout(() => {
                    const monsterDamage = this.performAttack(
                        { damage: this.monsterStats[monster.type].damage },
                        { health: this.currentHealth, x: this.player.x, y: this.player.y }
                    );
                    
                    // Update player health
                    this.modifyHealth(-monsterDamage);
                }, 250);
            }
            
            // Remove monster if dead
            if (monster.health <= 0) {
                this.monsters = this.monsters.filter(m => m !== monster);
            }
            
            // Update display
            this.drawMap();
            return;
        }
        
        // If no combat, proceed with movement
        if (this.isValidMove(newX, newY)) {
            // Check if new position has stairs
            if (this.map[newY][newX] === 'stairs') {
                this.goDownstairs();
                return;
            }
            
            // Update player position
            this.player.x = newX;
            this.player.y = newY;
            
            // Update camera position
            this.updateCamera();
            
            // Move monsters
            this.moveMonsters();
            
            // Compute field of view
            this.computeFOV();
            
            // Update display
            this.drawMap();
            
            // Update UI with player position
            this.updateUI();
        }
    }
    
    isValidMove(x, y) {
        // Check if the coordinates are within the map bounds
        if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) {
            return false;
        }
        
        // Check if the tile at the coordinates is passable
        const tile = this.map[y][x];
        
        // If no tile or it's a wall type, it's impassable
        if (!tile || this.isWallTile(tile.type)) {
            return false;
        }
        
        // If tile has a feature, check if it's passable
        if (tile.feature) {
            const impassableFeatures = ['tree', 'smallTree'];
            if (impassableFeatures.includes(tile.feature)) {
                return false;
            }
        }
        
        // Check for NPCs at the position
        for (const npc of this.npcs) {
            if (npc.x === x && npc.y === y) {
                return false; // Can't walk through NPCs
            }
        }
        
        return true;
    }
    
    isWallTile(tileType) {
        // List of all wall tile types
        const wallTypes = [
            'wallDirtTop', 'wallDirtSide', 'wallInner',
            'wallStoneTop', 'wallStoneSide',
            'wallBrickTop', 'wallBrickSide1', 'wallBrickSide2'
        ];
        
        return wallTypes.includes(tileType);
    }
    
    defineTileTypes() {
        // Define coordinates for each tile in the tileset
        // Format: [row, col] - starting from 0
        this.tiles = {
            // Walls
            'wallDirtTop': [0, 0],
            'wallDirtSide': [0, 1],
            'wallInner': [0, 2],
            'wallStoneTop': [1, 0],
            'wallStoneSide': [1, 1],
            'wallBrickTop': [2, 0],
            'wallBrickSide1': [2, 1],
            'wallBrickSide2': [2, 2],
            
            // Floors
            'floorDark': [6, 0],
            'floorStone1': [6, 1],
            'floorStone2': [6, 2],
            'floorStone3': [6, 3],
            'floorGrass1': [7, 1],
            'floorGrass2': [7, 2],
            'floorGrass3': [7, 3],
            'floorDirt1': [8, 1],
            'floorDirt2': [8, 2],
            'floorDirt3': [8, 3],
            
            // Features
            'door': [16, 0],
            'chest': [17, 0],
            'tree': [25, 3],
            'smallTree': [25, 2],
            'sapling': [25, 0],
            'mushroom': [20, 1],
            'stairsDown': [16, 7] // Add stairs down from the tileset
        };
    }
    
    defineCharacterTypes() {
        // Define coordinates for each character in the rogues tileset
        // Format: [row, col] - starting from 0
        this.characters = {
            // Row 1
            'dwarf': [0, 0],
            'elf': [0, 1],
            'ranger': [0, 2],
            'rogue': [0, 3],
            'bandit': [0, 4],
            
            // Row 2
            'knight': [1, 0],
            'maleFighter': [1, 1],
            'femaleKnight': [1, 2],
            'femaleKnightNoHelmet': [1, 3],
            'shieldKnight': [1, 4],
            
            // Row 3
            'monk': [2, 0],
            'priest': [2, 1],
            'femaleWarCleric': [2, 2],
            'maleWarCleric': [2, 3],
            'templar': [2, 4],
            'schemaMonk': [2, 5],
            'elderSchemaMonk': [2, 6],
            
            // Row 4
            'maleBarbarian': [3, 0],
            'maleWinterBarbarian': [3, 1],
            'femaleWinterBarbarian': [3, 2],
            'swordsman': [3, 3],
            'fencer': [3, 4],
            'femaleBarbarian': [3, 5],
            
            // Row 5
            'femaleWizard': [4, 0],
            'maleWizard': [4, 1],
            'druid': [4, 2],
            'desertSage': [4, 3],
            'dwarfMage': [4, 4],
            'warlock': [4, 5],
            
            // Row 6 - Commoners
            'farmer1': [6, 0],
            'farmer2': [6, 1],
            'farmer3': [6, 2],
            'baker': [6, 3],
            'blacksmith': [6, 4],
            'scholar': [6, 5],
            
            // Row 7 - Peasants
            'peasant1': [7, 0],
            'peasant2': [7, 1],
            'shopkeep': [7, 2],
            'elderlyWoman': [7, 3],
            'elderlyMan': [7, 4]
        };
    }
    
    defineMonsterTypes() {
        // Define coordinates for each monster in the monsters tileset
        // Format: [row, col] - starting from 0
        this.monsterTypes = {
            // Row 1 - Orcs and Goblins
            'orc': [0, 0],
            'orcWizard': [0, 1],
            'goblin': [0, 2],
            'orcBlademaster': [0, 3],
            'orcWarchief': [0, 4],
            'goblinArcher': [0, 5],
            'goblinMage': [0, 6],
            'goblinBrute': [0, 7],
            
            // Row 5 - Undead
            'skeleton': [4, 0],
            'skeletonArcher': [4, 1],
            'zombie': [4, 4],
            'ghoul': [4, 5],
            
            // Row 7 - Basic monsters
            'giantSpider': [6, 8],
            'lesserGiantSpider': [6, 9],
            'giantRat': [6, 11],
            
            // Row 11 - Fungi
            'smallMyconid': [10, 0],
            'largeMyconid': [10, 1]
        };
    }
    
    generateMap() {
        // Initialize empty map
        this.map = new Array(MAP_HEIGHT);
        for (let y = 0; y < MAP_HEIGHT; y++) {
            this.map[y] = new Array(MAP_WIDTH);
        }
        
        // Generate a basic cellular automata map using ROT.js
        const generator = new ROT.Map.Cellular(MAP_WIDTH, MAP_HEIGHT);
        
        // Adjust randomization based on depth for variety
        const wallChance = 0.45 + (this.currentLevel * 0.01); // Slightly increase wall density with depth
        generator.randomize(wallChance);
        
        // Run 4 generations of the automaton
        for (let i = 0; i < 4; i++) {
            generator.create();
        }
        
        // Create a temporary map to store the generated data
        let tempMap = {};
        
        // Apply the generated map to the temporary storage
        generator.create((x, y, value) => {
            // value = 1 for floor, 0 for wall
            const key = `${x},${y}`;
            tempMap[key] = { 
                x, 
                y, 
                isWall: !value 
            };
        });
        
        // Connect all non-wall sections
        generator.connect((x, y, value) => {
            const key = `${x},${y}`;
            if (tempMap[key]) {
                tempMap[key].isWall = !value;
            }
        }, 1);
        
        // Find all connected floor regions
        const regions = this.findConnectedRegions(tempMap);
        
        // Sort regions by size (largest first)
        regions.sort((a, b) => b.length - a.length);
        
        // If we have at least one region, make sure only the largest is floor, others are wall
        if (regions.length > 0) {
            const largestRegion = regions[0];
            const largestRegionKeys = new Set(largestRegion.map(pos => `${pos.x},${pos.y}`));
            
            // Mark all tiles not in the largest region as walls
            for (const key in tempMap) {
                if (!tempMap[key].isWall && !largestRegionKeys.has(key)) {
                    tempMap[key].isWall = true;
                }
            }
        }
        
        // Now transform the temporary map into our actual game map with proper tile types
        for (const key in tempMap) {
            const { x, y, isWall } = tempMap[key];
            
            if (!isWall) {
                // Floor tiles - change types based on level depth
                let floorTypes;
                
                if (this.currentLevel <= 3) {
                    // Upper levels - grass and dirt
                    floorTypes = ['floorGrass1', 'floorGrass2', 'floorGrass3', 'floorDirt1', 'floorDirt2', 'floorDirt3'];
                } else if (this.currentLevel <= 6) {
                    // Middle levels - stone and dirt
                    floorTypes = ['floorStone1', 'floorStone2', 'floorStone3', 'floorDirt1', 'floorDirt2', 'floorDirt3'];
                } else {
                    // Deep levels - mostly stone
                    floorTypes = ['floorStone1', 'floorStone2', 'floorStone3', 'floorDark'];
                }
                
                const randomFloor = floorTypes[Math.floor(Math.random() * floorTypes.length)];
                this.map[y][x] = { type: randomFloor };
                
                // 5% chance to place a feature on the floor
                if (Math.random() < 0.05) {
                    let features;
                    
                    if (this.currentLevel <= 3) {
                        // Upper levels - nature features
                        features = ['mushroom', 'sapling'];
                    } else {
                        // Lower levels - dungeon features
                        features = ['mushroom'];
                    }
                    
                    // Add rare features
                    if (Math.random() < 0.02) {
                        if (this.currentLevel <= 3) {
                            features.push('smallTree');
                        }
                    }
                    if (Math.random() < 0.01) {
                        features.push('chest');
                    }
                    
                    const randomFeature = features[Math.floor(Math.random() * features.length)];
                    this.map[y][x].feature = randomFeature;
                }
            } else {
                // Wall tiles - change types based on level depth
                let wallTypes;
                
                if (this.currentLevel <= 3) {
                    // Upper levels - dirt and brick
                    wallTypes = ['wallBrickTop', 'wallDirtTop'];
                } else if (this.currentLevel <= 6) {
                    // Middle levels - brick and stone
                    wallTypes = ['wallBrickTop', 'wallStoneTop'];
                } else {
                    // Deep levels - mostly stone
                    wallTypes = ['wallStoneTop', 'wallStoneTop', 'wallBrickTop'];
                }
                
                const randomWall = wallTypes[Math.floor(Math.random() * wallTypes.length)];
                this.map[y][x] = { type: randomWall };
            }
        }
        
        // Add trees (only on upper levels)
        if (this.currentLevel <= 3) {
            const numTrees = 4 - this.currentLevel; // Fewer trees as you go deeper
            for (let i = 0; i < numTrees; i++) {
                const validTiles = ['floorGrass1', 'floorGrass2', 'floorGrass3'];
                this.placeFeatureOnSpecificFloor('tree', validTiles);
            }
        }
        
        // Add stairs down - always 1 per level
        // Stairs are added to a random position in the largest connected region
        this.placeFeatureOnEmptyFloor('stairsDown');
        
        // Verify map has at least some floor tiles
        let hasFloor = false;
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                if (this.map[y][x] && !this.isWallTile(this.map[y][x].type)) {
                    hasFloor = true;
                    break;
                }
            }
            if (hasFloor) break;
        }
        
        // If no floor tiles were generated (very rare but possible), regenerate the map
        if (!hasFloor) {
            this.generateMap();
        }
    }
    
    findConnectedRegions(tempMap) {
        // Create a set to track visited positions
        const visited = new Set();
        // Array to store all regions
        const regions = [];
        
        // Loop through all positions
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                const key = `${x},${y}`;
                
                // Skip if already visited or if it's a wall
                if (visited.has(key) || tempMap[key].isWall) {
                    continue;
                }
                
                // Start a new flood fill from this position
                const region = this.floodFill(tempMap, x, y, visited);
                regions.push(region);
            }
        }
        
        return regions;
    }
    
    floodFill(tempMap, startX, startY, visited) {
        // The region we're building
        const region = [];
        
        // Queue for breadth-first search
        const queue = [{x: startX, y: startY}];
        
        while (queue.length > 0) {
            const {x, y} = queue.shift();
            const key = `${x},${y}`;
            
            // Skip if out of bounds, already visited, or a wall
            if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT || 
                visited.has(key) || tempMap[key].isWall) {
                continue;
            }
            
            // Mark as visited
            visited.add(key);
            
            // Add to region
            region.push({x, y});
            
            // Add neighbors to queue
            queue.push({x: x+1, y: y});
            queue.push({x: x-1, y: y});
            queue.push({x: x, y: y+1});
            queue.push({x: x, y: y-1});
        }
        
        return region;
    }
    
    placeFeatureOnEmptyFloor(featureType) {
        // Get all available floor tiles with no features
        const availableTiles = [];
        
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                if (this.map[y][x] && 
                    !this.isWallTile(this.map[y][x].type) && 
                    !this.map[y][x].feature) {
                    availableTiles.push({x, y});
                }
            }
        }
        
        // If there are available tiles, place the feature on a random one
        if (availableTiles.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableTiles.length);
            const {x, y} = availableTiles[randomIndex];
            this.map[y][x].feature = featureType;
            return true;
        }
        
        return false;
    }
    
    placeFeatureOnSpecificFloor(featureType, validFloorTypes) {
        // Get all available floor tiles of the specified types with no features
        const availableTiles = [];
        
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                if (this.map[y][x] && 
                    validFloorTypes.includes(this.map[y][x].type) && 
                    !this.map[y][x].feature) {
                    availableTiles.push({x, y});
                }
            }
        }
        
        // If there are available tiles, place the feature on a random one
        if (availableTiles.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableTiles.length);
            const {x, y} = availableTiles[randomIndex];
            this.map[y][x].feature = featureType;
            return true;
        }
        
        return false;
    }
    
    placeCharacters() {
        // Empty the NPCs array
        this.npcs = [];
        
        // Characters to use for NPCs - adjust based on level
        let npcTypes;
        
        if (this.currentLevel <= 3) {
            // Upper levels - mostly civilians
            npcTypes = [
                'peasant1', 'peasant2', 'farmer1', 'farmer2', 'farmer3',
                'baker', 'blacksmith', 'scholar', 'elderlyWoman', 'elderlyMan',
                'shopkeep', 'monk', 'priest'
            ];
        } else if (this.currentLevel <= 6) {
            // Middle levels - more adventurers
            npcTypes = [
                'dwarf', 'elf', 'ranger', 'knight', 'maleFighter', 'femaleKnight',
                'monk', 'priest', 'swordsman', 'fencer'
            ];
        } else {
            // Deep levels - tougher characters
            npcTypes = [
                'maleBarbarian', 'femaleBarbarian', 'maleWizard', 'femaleWizard',
                'warlock', 'templar', 'shieldKnight', 'druid', 'bandit'
            ];
        }
        
        // Place player character at the center of the map
        const centerX = Math.floor(MAP_WIDTH / 2);
        const centerY = Math.floor(MAP_HEIGHT / 2);
        
        // Find the nearest valid position to the center
        let playerX = centerX;
        let playerY = centerY;
        let searchRadius = 0;
        let playerPlaced = false;
        
        while (!playerPlaced && searchRadius < Math.max(MAP_WIDTH, MAP_HEIGHT)) {
            for (let dy = -searchRadius; dy <= searchRadius; dy++) {
                for (let dx = -searchRadius; dx <= searchRadius; dx++) {
                    const x = centerX + dx;
                    const y = centerY + dy;
                    
                    if (this.isValidMove(x, y)) {
                        playerX = x;
                        playerY = y;
                        playerPlaced = true;
                        break;
                    }
                }
                if (playerPlaced) break;
            }
            searchRadius++;
        }
        
        if (playerPlaced) {
            this.player = {
                x: playerX,
                y: playerY,
                type: 'rogue' // Player is a rogue
            };
        } else {
            // This shouldn't happen with our improved map generation, but just in case
            console.error("No valid position found for player placement.");
            return;
        }
        
        // Place NPCs (5-10 random characters)
        // Add more NPCs as levels get deeper
        const numNPCs = 5 + Math.floor(Math.random() * 6) + Math.floor(this.currentLevel / 2); 
        
        for (let i = 0; i < numNPCs; i++) {
            // Get available positions (no player, no other NPCs, valid move)
            const availableForNPC = [];
            for (let y = 0; y < MAP_HEIGHT; y++) {
                for (let x = 0; x < MAP_WIDTH; x++) {
                    // Check if position is valid for an NPC
                    if (this.isValidMove(x, y) && 
                        !(this.player.x === x && this.player.y === y) &&
                        !this.npcs.some(npc => npc.x === x && npc.y === y)) {
                        availableForNPC.push({x, y});
                    }
                }
            }
            
            // If there are no more available positions, stop adding NPCs
            if (availableForNPC.length === 0) break;
            
            // Choose a random position and NPC type
            const randomPos = availableForNPC[Math.floor(Math.random() * availableForNPC.length)];
            const npcType = npcTypes[Math.floor(Math.random() * npcTypes.length)];
            
            // Add NPC to the list
            this.npcs.push({
                x: randomPos.x,
                y: randomPos.y,
                type: npcType
            });
        }
    }
    
    placeMonsters() {
        // Clear existing monsters
        this.monsters = [];
        
        // Number of monsters increases with depth
        const numMonsters = 3 + Math.floor(this.currentLevel / 2);
        
        // Different monster pools based on depth
        let monsterPool;
        if (this.currentLevel <= 3) {
            monsterPool = ['goblin', 'giantRat', 'smallMyconid'];
        } else if (this.currentLevel <= 6) {
            monsterPool = ['orc', 'goblinArcher', 'giantSpider', 'largeMyconid'];
        } else {
            monsterPool = ['orcBlademaster', 'orcWizard', 'skeleton', 'ghoul'];
        }
        
        for (let i = 0; i < numMonsters; i++) {
            // Get available positions (no player, no NPCs, no other monsters, valid move)
            const availableSpots = [];
            for (let y = 0; y < MAP_HEIGHT; y++) {
                for (let x = 0; x < MAP_WIDTH; x++) {
                    if (this.isValidMove(x, y) && 
                        !(this.player.x === x && this.player.y === y) &&
                        !this.npcs.some(npc => npc.x === x && npc.y === y) &&
                        !this.monsters.some(monster => monster.x === x && monster.y === y)) {
                        availableSpots.push({x, y});
                    }
                }
            }
            
            if (availableSpots.length === 0) break;
            
            const spot = availableSpots[Math.floor(Math.random() * availableSpots.length)];
            const monsterType = monsterPool[Math.floor(Math.random() * monsterPool.length)];
            
            // Create monster with health
            this.monsters.push({
                x: spot.x,
                y: spot.y,
                type: monsterType,
                health: this.monsterStats[monsterType].health,
                maxHealth: this.monsterStats[monsterType].health,
                lastMoveTime: 0
            });
        }
    }
    
    moveMonsters() {
        if (!this.player) return;
        
        this.monsters.forEach(monster => {
            // Only move occasionally - could tie to a turn system later
            if (Math.random() < 0.8) return; // 80% chance to not move
            
            // Choose a random direction
            const directions = [
                {x: -1, y: 0},
                {x: 1, y: 0},
                {x: 0, y: -1},
                {x: 0, y: 1}
            ];
            
            const direction = directions[Math.floor(Math.random() * directions.length)];
            const newX = monster.x + direction.x;
            const newY = monster.y + direction.y;
            
            // Check if monster is adjacent to player - if so, attack instead of moving
            if (Math.abs(monster.x - this.player.x) <= 1 && 
                Math.abs(monster.y - this.player.y) <= 1) {
                
                // Monster attacks player
                const damage = this.performAttack(
                    { damage: this.monsterStats[monster.type].damage },
                    { health: this.currentHealth, x: this.player.x, y: this.player.y }
                );
                
                // Update player health
                this.modifyHealth(-damage);
                return;
            }
            
            // Otherwise try to move (normal movement logic)
            if (this.isValidMove(newX, newY) && 
                !(this.player.x === newX && this.player.y === newY) &&
                !this.npcs.some(npc => npc.x === newX && npc.y === newY) &&
                !this.monsters.some(m => m.x === newX && m.y === newY)) {
                
                monster.x = newX;
                monster.y = newY;
            }
        });
    }
    
    goDownstairs() {
        // Increment dungeon level
        this.currentLevel++;
        
        // Reset FOV and explored tiles
        this.visibleTiles = {};
        this.exploredTiles = {};
        
        // Generate new floor
        this.generateMap();
        
        // Place characters on the new floor
        this.placeCharacters();
        
        // Compute FOV for new position
        this.computeFOV();
        
        // Update camera position to center on player
        this.updateCamera();
        
        // Draw the map
        this.drawMap();
        
        // Update UI
        this.updateUI();
        
        // Show level transition message
        this.showLevelMessage();
    }
    
    showLevelMessage() {
        // Add a temporary level transition message to the screen
        const message = document.createElement('div');
        message.textContent = `Descending to level ${this.currentLevel}...`;
        message.style.position = 'absolute';
        message.style.top = '50%';
        message.style.left = '50%';
        message.style.transform = 'translate(-50%, -50%)';
        message.style.color = 'white';
        message.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        message.style.padding = '20px';
        message.style.borderRadius = '5px';
        message.style.fontSize = '24px';
        message.style.zIndex = '1000';
        
        document.body.appendChild(message);
        
        // Remove message after 2 seconds
        setTimeout(() => {
            document.body.removeChild(message);
        }, 2000);
    }
    
    updateUI() {
        // Create or update the level indicator
        let levelIndicator = document.getElementById('level-indicator');
        
        if (!levelIndicator) {
            levelIndicator = document.createElement('div');
            levelIndicator.id = 'level-indicator';
            levelIndicator.style.position = 'absolute';
            levelIndicator.style.top = '10px';
            levelIndicator.style.left = '10px';
            levelIndicator.style.color = 'white';
            levelIndicator.style.padding = '5px 10px';
            levelIndicator.style.borderRadius = '3px';
            levelIndicator.style.fontFamily = 'Arial, sans-serif';
            levelIndicator.style.textShadow = '2px 2px 3px rgba(0,0,0,0.8)'; // Add text shadow for better visibility
            
            document.getElementById('game-container').appendChild(levelIndicator);
        }
        
        // Remove the coordinates from the level display
        levelIndicator.textContent = `Dungeon Level: ${this.currentLevel}`;

        // Create or update the health bar
        let healthBar = document.getElementById('health-bar-container');
        
        if (!healthBar) {
            // Create container
            healthBar = document.createElement('div');
            healthBar.id = 'health-bar-container';
            healthBar.style.position = 'absolute';
            healthBar.style.top = '45px';
            healthBar.style.left = '10px';
            healthBar.style.padding = '5px 10px';
            healthBar.style.borderRadius = '3px';
            healthBar.style.width = '200px';
            healthBar.style.fontFamily = 'Arial, sans-serif';
            
            // Create heart icon
            const heart = document.createElement('span');
            heart.textContent = '❤️';
            heart.style.marginRight = '5px';
            heart.style.fontSize = '14px';
            heart.style.textShadow = '2px 2px 3px rgba(0,0,0,0.8)'; // Add text shadow for better visibility
            healthBar.appendChild(heart);
            
            // Create the actual health bar
            const bar = document.createElement('div');
            bar.id = 'health-bar';
            bar.style.height = '15px';
            bar.style.width = '160px';
            bar.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'; // Keep slight darkness for the empty part
            bar.style.borderRadius = '7px';
            bar.style.overflow = 'hidden';
            bar.style.display = 'inline-block';
            bar.style.verticalAlign = 'middle';
            bar.style.boxShadow = '0 0 5px rgba(0,0,0,0.5)'; // Add subtle shadow
            
            // Create the fill
            const fill = document.createElement('div');
            fill.id = 'health-fill';
            fill.style.height = '100%';
            fill.style.width = '100%';
            fill.style.background = 'linear-gradient(to right, #ff5f6d, #ffc371)';
            fill.style.transition = 'width 0.3s ease-in-out';
            bar.appendChild(fill);
            
            healthBar.appendChild(bar);
            
            // Create health text display
            const healthText = document.createElement('div');
            healthText.id = 'health-text';
            healthText.style.color = 'white';
            healthText.style.marginTop = '5px';
            healthText.style.fontSize = '12px';
            healthText.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
            healthBar.appendChild(healthText);
            
            document.getElementById('game-container').appendChild(healthBar);
        }
        
        // Update health bar fill
        const healthFill = document.getElementById('health-fill');
        const healthPercentage = (this.currentHealth / this.maxHealth) * 100;
        healthFill.style.width = `${healthPercentage}%`;
        
        // Update health text
        const healthText = document.getElementById('health-text');
        if (healthText) {
            healthText.textContent = `${Math.round(this.currentHealth)} / ${this.maxHealth}`;
        }
    }

    // Add method to modify health
    modifyHealth(amount) {
        this.currentHealth = Math.max(0, Math.min(this.maxHealth, this.currentHealth + amount));
        
        // Add red flash effect if taking damage
        if (amount < 0) {
            this.playerDamageFlash();
        }
        
        this.updateUI();
        
        // Check for player death
        if (this.currentHealth <= 0) {
            this.playerDied();
        }
    }
    
    // Add player damage visual effect
    playerDamageFlash() {
        const gameContainer = document.getElementById('game-container');
        const flash = document.createElement('div');
        flash.style.position = 'absolute';
        flash.style.top = '0';
        flash.style.left = '0';
        flash.style.width = '100%';
        flash.style.height = '100%';
        flash.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
        flash.style.pointerEvents = 'none';
        flash.style.zIndex = '999';
        
        gameContainer.appendChild(flash);
        
        // Fade out and remove
        flash.animate([
            { opacity: 0.3 },
            { opacity: 0 }
        ], {
            duration: 300,
            easing: 'ease-out'
        }).onfinish = () => flash.remove();
    }
    
    // Handle player death
    playerDied() {
        // Create a death message overlay
        const gameContainer = document.getElementById('game-container');
        const deathMessage = document.createElement('div');
        deathMessage.style.position = 'absolute';
        deathMessage.style.top = '50%';
        deathMessage.style.left = '50%';
        deathMessage.style.transform = 'translate(-50%, -50%)';
        deathMessage.style.color = 'red';
        deathMessage.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        deathMessage.style.padding = '20px';
        deathMessage.style.borderRadius = '10px';
        deathMessage.style.fontSize = '24px';
        deathMessage.style.fontWeight = 'bold';
        deathMessage.style.textAlign = 'center';
        deathMessage.style.zIndex = '1000';
        deathMessage.textContent = 'You have died!';
        
        // Add a restart button
        const restartButton = document.createElement('button');
        restartButton.textContent = 'Restart Game';
        restartButton.style.marginTop = '15px';
        restartButton.style.padding = '10px 20px';
        restartButton.style.fontSize = '16px';
        restartButton.style.cursor = 'pointer';
        restartButton.onclick = () => {
            location.reload(); // Simple restart by reloading the page
        };
        
        deathMessage.appendChild(document.createElement('br'));
        deathMessage.appendChild(restartButton);
        gameContainer.appendChild(deathMessage);
    }
    
    computeFOV() {
        // Reset visible tiles
        this.visibleTiles = {};
        
        if (!this.player) return;
        
        // Create FOV calculator using Precise Shadowcasting algorithm
        const fov = new ROT.FOV.PreciseShadowcasting((x, y) => {
            // Return 0 for walls (completely blocking) or 1 for non-walls (completely transparent)
            if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return 0;
            
            const tile = this.map[y][x];
            if (!tile || this.isWallTile(tile.type)) return 0;
            
            // Check if the tile has an impassable feature
            if (tile.feature && ['tree', 'smallTree'].includes(tile.feature)) return 0.3; // Partially transparent
            
            return 1; // Fully transparent
        });
        
        // Compute FOV from player position
        fov.compute(this.player.x, this.player.y, FOV_RADIUS, (x, y, r, visibility) => {
            // Mark tile as visible with a visibility value based on distance
            const key = `${x},${y}`;
            // Calculate distance from player
            const dx = x - this.player.x;
            const dy = y - this.player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Calculate visibility based on distance (closer = brighter)
            const maxDistance = FOV_RADIUS;
            const normalizedDistance = Math.min(distance / maxDistance, 1);
            // More dramatic falloff: cubic for even sharper darkness at edges
            const visibilityValue = Math.pow(1 - (normalizedDistance * 0.6), 3); // Brighter near player, sharper falloff
            
            this.visibleTiles[key] = Math.min(1, visibilityValue * 1.5); // Boost visibility in FOV
            
            // Also mark as explored with an even lower visibility
            this.exploredTiles[key] = Math.max(0.05, visibilityValue * 0.15); // Much darker for explored areas
        });
    }
    
    isTileVisible(x, y) {
        return this.visibleTiles[`${x},${y}`] !== undefined;
    }
    
    isTileExplored(x, y) {
        return this.exploredTiles[`${x},${y}`] !== undefined;
    }
    
    // Convert map coordinates to screen coordinates based on camera position
    mapToScreenX(x) {
        return (x - this.camera.x) * TILE_SIZE;
    }
    
    mapToScreenY(y) {
        return (y - this.camera.y) * TILE_SIZE;
    }
    
    // Check if a map position is within the current viewport
    isOnScreen(x, y) {
        return x >= this.camera.x && 
               x < this.camera.x + this.viewportWidth && 
               y >= this.camera.y && 
               y < this.camera.y + this.viewportHeight;
    }
    
    drawMap() {
        if (!this.tilesetLoaded || !this.roguesLoaded || !this.monstersLoaded) return;
        
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Calculate viewport boundaries
        const startX = this.camera.x;
        const endX = Math.min(this.camera.x + this.viewportWidth, MAP_WIDTH);
        const startY = this.camera.y;
        const endY = Math.min(this.camera.y + this.viewportHeight, MAP_HEIGHT);
        
        // Draw only the tiles that are within the viewport
        for (let y = startY; y < endY; y++) {
            if (y < 0 || y >= MAP_HEIGHT) continue;
            
            for (let x = startX; x < endX; x++) {
                if (x < 0 || x >= MAP_WIDTH) continue;
                
                const tile = this.map[y][x];
                if (tile) {
                    const isVisible = this.isTileVisible(x, y);
                    const isExplored = this.isTileExplored(x, y);
                    
                    // Skip tiles that haven't been seen yet
                    if (!isVisible && !isExplored) continue;
                    
                    // Calculate screen position
                    const screenX = this.mapToScreenX(x);
                    const screenY = this.mapToScreenY(y);
                    
                    // Draw the base tile
                    const [tileY, tileX] = this.tiles[tile.type];
                    
                    // Set appropriate alpha based on visibility
                    if (isVisible) {
                        this.ctx.globalAlpha = this.visibleTiles[`${x},${y}`];
                    } else {
                        this.ctx.globalAlpha = this.exploredTiles[`${x},${y}`];
                    }
                    
                    this.ctx.drawImage(
                        this.tilesetImage,
                        tileX * TILE_SIZE, tileY * TILE_SIZE, TILE_SIZE, TILE_SIZE, // Source rectangle
                        screenX, screenY, TILE_SIZE, TILE_SIZE // Destination rectangle
                    );
                    
                    // Draw feature if present
                    if (tile.feature) {
                        const [featureY, featureX] = this.tiles[tile.feature];
                        this.ctx.drawImage(
                            this.tilesetImage,
                            featureX * TILE_SIZE, featureY * TILE_SIZE, TILE_SIZE, TILE_SIZE, // Source rectangle
                            screenX, screenY, TILE_SIZE, TILE_SIZE // Destination rectangle
                        );
                    }
                }
            }
        }
        
        // Draw NPCs (only if visible and on screen)
        for (const npc of this.npcs) {
            if (this.isTileVisible(npc.x, npc.y) && this.isOnScreen(npc.x, npc.y)) {
                const screenX = this.mapToScreenX(npc.x);
                const screenY = this.mapToScreenY(npc.y);
                
                this.ctx.globalAlpha = 1.0;
                const [charY, charX] = this.characters[npc.type];
                this.ctx.drawImage(
                    this.roguesImage,
                    charX * TILE_SIZE, charY * TILE_SIZE, TILE_SIZE, TILE_SIZE, // Source rectangle
                    screenX, screenY, TILE_SIZE, TILE_SIZE // Destination rectangle
                );
            }
        }
        
        // Always draw player character if on screen
        if (this.player && this.isOnScreen(this.player.x, this.player.y)) {
            const screenX = this.mapToScreenX(this.player.x);
            const screenY = this.mapToScreenY(this.player.y);
            
            this.ctx.globalAlpha = 1.0;
            const [charY, charX] = this.characters[this.player.type];
            this.ctx.drawImage(
                this.roguesImage,
                charX * TILE_SIZE, charY * TILE_SIZE, TILE_SIZE, TILE_SIZE, // Source rectangle
                screenX, screenY, TILE_SIZE, TILE_SIZE // Destination rectangle
            );
        }
        
        // Draw monsters (only if visible and on screen)
        for (const monster of this.monsters) {
            if (this.isTileVisible(monster.x, monster.y) && this.isOnScreen(monster.x, monster.y)) {
                const screenX = this.mapToScreenX(monster.x);
                const screenY = this.mapToScreenY(monster.y);
                
                this.ctx.globalAlpha = this.visibleTiles[`${monster.x},${monster.y}`];
                const [monsterY, monsterX] = this.monsterTypes[monster.type];
                this.ctx.drawImage(
                    this.monstersImage,
                    monsterX * TILE_SIZE, monsterY * TILE_SIZE, TILE_SIZE, TILE_SIZE,
                    screenX, screenY, TILE_SIZE, TILE_SIZE
                );
            }
        }
        
        // Reset global alpha
        this.ctx.globalAlpha = 1.0;
    }

    // Add combat methods
    performAttack(attacker, target) {
        // Calculate random damage
        const damage = Math.floor(
            Math.random() * (attacker.damage[1] - attacker.damage[0] + 1) + attacker.damage[0]
        );
        
        // Apply damage
        target.health = Math.max(0, target.health - damage);
        
        // Create damage number
        this.showDamageNumber(damage, target.x, target.y);
        
        // Screen shake on hits
        this.screenShake(Math.min(damage / 2, 5));
        
        return damage;
    }

    showDamageNumber(amount, x, y) {
        // Create damage number element
        const number = document.createElement('div');
        number.className = 'damage-number';
        number.textContent = Math.round(amount);
        
        // Convert game coordinates to screen coordinates
        const screenX = this.mapToScreenX(x);
        const screenY = this.mapToScreenY(y);
        
        // Position the number
        number.style.left = `${screenX + TILE_SIZE/2}px`;
        number.style.top = `${screenY}px`;
        number.style.position = 'absolute';
        number.style.color = '#ff0000';
        number.style.fontWeight = 'bold';
        number.style.textShadow = '2px 2px 0 #000';
        number.style.zIndex = '1000';
        
        // Add to game container
        document.getElementById('game-container').appendChild(number);
        
        // Animate and remove
        number.animate([
            { transform: 'translateY(0)', opacity: 1 },
            { transform: 'translateY(-30px)', opacity: 0 }
        ], {
            duration: 1000,
            easing: 'ease-out'
        }).onfinish = () => number.remove();
    }

    screenShake(intensity) {
        const container = document.getElementById('game-container');
        const duration = 100; // milliseconds
        let start = null;
        
        function shake(timestamp) {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            
            if (progress < duration) {
                const x = Math.random() * intensity * 2 - intensity;
                const y = Math.random() * intensity * 2 - intensity;
                container.style.transform = `translate(${x}px, ${y}px)`;
                requestAnimationFrame(shake);
            } else {
                container.style.transform = 'translate(0, 0)';
            }
        }
        
        requestAnimationFrame(shake);
    }
}

// Initialize the game when the page loads
window.addEventListener('load', () => {
    const game = new GladelikeGame();
}); 