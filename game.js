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
        
        // Set up player character and NPCs
        this.player = null;
        this.npcs = [];
        
        // FOV and map memory
        this.visibleTiles = {};
        this.exploredTiles = {};
        
        // Dungeon depth tracking
        this.currentLevel = 1;
        
        // Track resource loading
        this.resourcesLoaded = 0;
        this.totalResources = 2; // tiles.png and rogues.png
        
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
        
        // Define tile types and character types
        this.defineTileTypes();
        this.defineCharacterTypes();
        
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
        // Add keyboard event listeners
        window.addEventListener('keydown', (e) => {
            if (!this.player) return;
            
            let newX = this.player.x;
            let newY = this.player.y;
            
            // Handle different arrow keys
            switch (e.key) {
                case 'ArrowUp':
                    newY--;
                    break;
                case 'ArrowDown':
                    newY++;
                    break;
                case 'ArrowLeft':
                    newX--;
                    break;
                case 'ArrowRight':
                    newX++;
                    break;
                default:
                    return; // Ignore other keys
            }
            
            // Check if the move is valid
            if (this.isValidMove(newX, newY)) {
                // Check if new position has stairs
                const tile = this.map[newY][newX];
                const hasStairs = tile && tile.feature === 'stairsDown';
                
                // Move the player
                this.player.x = newX;
                this.player.y = newY;
                
                // If player stepped on stairs, go to next level
                if (hasStairs) {
                    this.goDownstairs();
                } else {
                    // Regular movement
                    this.computeFOV();
                    this.updateCamera();
                    this.drawMap();
                    this.updateUI();
                }
            }
        });
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
            levelIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            levelIndicator.style.padding = '5px 10px';
            levelIndicator.style.borderRadius = '3px';
            levelIndicator.style.fontFamily = 'Arial, sans-serif';
            
            document.getElementById('game-container').appendChild(levelIndicator);
        }
        
        levelIndicator.textContent = `Dungeon Level: ${this.currentLevel} (${this.player.x}, ${this.player.y})`;
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
            // Mark tile as visible
            const key = `${x},${y}`;
            this.visibleTiles[key] = true;
            
            // Also mark as explored
            this.exploredTiles[key] = true;
        });
    }
    
    isTileVisible(x, y) {
        return this.visibleTiles[`${x},${y}`] === true;
    }
    
    isTileExplored(x, y) {
        return this.exploredTiles[`${x},${y}`] === true;
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
        if (!this.tilesetLoaded || !this.roguesLoaded) return;
        
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
                        this.ctx.globalAlpha = 1.0; // Fully visible
                    } else {
                        this.ctx.globalAlpha = 0.5; // Dimmed for explored but not visible
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
        
        // Reset global alpha
        this.ctx.globalAlpha = 1.0;
    }
}

// Initialize the game when the page loads
window.addEventListener('load', () => {
    const game = new GladelikeGame();
}); 