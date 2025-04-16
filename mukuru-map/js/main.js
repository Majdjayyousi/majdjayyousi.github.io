// Initialize the map centered on Mukuru, Nairobi
const mukuruCoordinates = [-1.3097, 36.8718]; // Approximate coordinates for Mukuru

// Load saved settings from localStorage or use defaults
const savedSettings = loadSettings();

const map = L.map('map', {
    attributionControl: false, // Remove attribution control
    zoomDelta: 0.17, // Smaller zoom increments (approximately 1/6 of default)
    zoomSnap: 0.1  // Allow for fractional zoom levels with 0.1 precision
}).setView(
    savedSettings.mapPosition?.center || mukuruCoordinates, 
    savedSettings.mapPosition?.zoom || 14
);

// Define base layers
const standardLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '', // Empty attribution
    maxZoom: 19,
    opacity: 0.7 // Initial opacity
});

const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '', // Empty attribution
    maxZoom: 19,
    opacity: 0.7 // Initial opacity
});

// Set default base layer based on saved settings
let baseLayer;
if (savedSettings.mapStyle === 'satellite') {
    baseLayer = satelliteLayer.addTo(map);
} else {
    baseLayer = standardLayer.addTo(map);
}

// Apply saved opacity
if (savedSettings.opacity) {
    baseLayer.setOpacity(savedSettings.opacity);
    // Update slider to match the stored opacity
    document.getElementById('opacity-slider').value = savedSettings.opacity;
    document.getElementById('opacity-value').textContent = `${Math.round(savedSettings.opacity * 100)}%`;
}

// Apply saved dot size
if (savedSettings.dotSize) {
    document.getElementById('dot-size-slider').value = savedSettings.dotSize;
    document.getElementById('dot-size-value').textContent = `${savedSettings.dotSize}px`;
}

// Apply saved group opacities
if (savedSettings.groupOpacity) {
    // Set Njenga opacity
    if (typeof savedSettings.groupOpacity["Mukuru Kwa Njenga"] !== 'undefined') {
        const njengaOpacity = savedSettings.groupOpacity["Mukuru Kwa Njenga"];
        document.getElementById('njenga-opacity-slider').value = njengaOpacity;
        document.getElementById('njenga-opacity-value').textContent = `${Math.round(njengaOpacity * 100)}%`;
    }
    
    // Set Reuben opacity
    if (typeof savedSettings.groupOpacity["Mukuru Kwa Reuben"] !== 'undefined') {
        const reubenOpacity = savedSettings.groupOpacity["Mukuru Kwa Reuben"];
        document.getElementById('reuben-opacity-slider').value = reubenOpacity;
        document.getElementById('reuben-opacity-value').textContent = `${Math.round(reubenOpacity * 100)}%`;
    }
}

// Define the discrete density values that correspond to slider positions
const densityValues = [20, 50, 100, 205, 340];
const densityLabels = ["Very Dense (3)", "Dense (7)", "Medium (15)", "Sparse (30)", "Very Sparse (50)"];

// Apply saved dot density and update label
if (savedSettings.dotDensity) {
    // Find the closest index in densityValues array
    const closestIndex = densityValues.reduce((prevIndex, value, index) => {
        return Math.abs(value - savedSettings.dotDensity) < Math.abs(densityValues[prevIndex] - savedSettings.dotDensity)
            ? index : prevIndex;
    }, 0);
    
    // Set the slider to this index
    document.getElementById('dot-density-slider').value = closestIndex;
    
    // Update the label
    document.getElementById('dot-density-label').textContent = densityLabels[closestIndex];
}

// Create base layers object for layer control
const baseLayers = {
    "Standard": standardLayer,
    "Satellite": satelliteLayer
};

// Add layer control to switch between base layers
L.control.layers(baseLayers, null, {
    position: 'topright',
    collapsed: false
}).addTo(map);

// Layer groups
const contoursLayer = L.layerGroup();
const labelsLayer = L.layerGroup();
const iconsLayer = L.layerGroup();
const densityLayer = L.layerGroup();
const groupLabelsLayer = L.layerGroup(); // New layer for group labels
const excludeLayer = L.layerGroup(); // Layer for exclusion zones

// Settlement grouping
const settlementGroups = {
    "Mukuru Kwa Njenga": [
        "Sisal", "Vietnam", "Milimani", "Wape Wape", "Zone 48", "Moto Moto", "Riara", "Buildings"
    ],
    "Mukuru Kwa Reuben": [
        "Gateway", "Railway", "Wesinya", "Diamond", "Kosovo", "Rurie", 
        "Simba Cool", "Feed the Children", "Mombasa", "Gatope", "Bins"
    ]
};

// Real population data from 2016 census
const populationData = {
    "Mukuru Kwa Njenga": 133032,
    "Mukuru Kwa Reuben": 97833,
    "Viwandani": 70818,
    "Total": 301683
};

// Area adjustment factors for specific settlements that need density correction
const areaAdjustments = {
    "Vietnam": 1,  // Reduce effective area to increase density
    "Rurie": 1,    // Reduce effective area to increase density
    "Milimani": 1     // Reduce effective area to increase density
};

// Population density data (people per acre) for major settlements
const populationDensityData = {
    "Mukuru Kwa Njenga": 486,  // people per acre
    "Mukuru Kwa Reuben": 415,  // people per acre 
    "Viwandani": 472,          // people per acre
    "Average": 466             // average people per acre
};

// Estimated sub-settlement population density ratios (relative to their parent settlement)
// This ensures consistent visual density within all areas
const subSettlementDensityRatios = {
    // Mukuru Kwa Njenga sub-settlements
    "Sisal": 1.0,
    "Vietnam": 1.0,
    "Milimani": 1.0,
    "Wape Wape": 1.0,
    "Zone 48": 1.0,
    "Moto Moto": 1.0,
    "Riara": 1.1,  // Slightly higher density
    "Buildings": 1.0,
    
    // Mukuru Kwa Reuben sub-settlements
    "Gateway": 1.0,
    "Railway": 1.0,
    "Wesinya": 1.0,
    "Diamond": 1.0,
    "Kosovo": 1.0,
    "Rurie": 1.1,   // Slightly higher density
    "Simba Cool": 1.0,
    "Feed the Children": 1.0,
    "Mombasa": 1.0,
    "Gatope": 1.0,
    "Bins": 1.0
};

// Editable colors for provision types
let provisionColors = {
    "Informal": "#d95f02", // Orange for Informal
    "KPLC": "#1b9e77"      // Teal for KPLC
};

// Load saved colors if available
try {
    const savedColors = JSON.parse(localStorage.getItem('mukuruMapColors'));
    if (savedColors && savedColors.Informal && savedColors.KPLC) {
        provisionColors = savedColors;
    }
} catch (e) {
    console.error('Error loading colors from localStorage:', e);
}

// Function to get color based on provision type (no longer depends on settlement group)
function getSettlementColor(name, provisionType = "Informal") {
    return provisionColors[provisionType];
}

// Save colors to localStorage
function saveColors() {
    try {
        localStorage.setItem('mukuruMapColors', JSON.stringify(provisionColors));
    } catch (e) {
        console.error('Error saving colors to localStorage:', e);
    }
}

// Store references to features by settlement name
const settlementFeatures = {};

// Apply saved toggle states
if (savedSettings.toggles.contours) contoursLayer.addTo(map);
if (savedSettings.toggles.labels) labelsLayer.addTo(map);
if (savedSettings.toggles.icons) iconsLayer.addTo(map);
if (savedSettings.toggles.density) densityLayer.addTo(map);
if (savedSettings.toggles.exclusion !== false) excludeLayer.addTo(map); // Default to true if not set
groupLabelsLayer.addTo(map); // Always add group labels initially

// Update checkbox states to match saved settings
document.getElementById('contours-toggle').checked = savedSettings.toggles.contours;
document.getElementById('labels-toggle').checked = savedSettings.toggles.labels;
document.getElementById('icons-toggle').checked = savedSettings.toggles.icons;
document.getElementById('density-toggle').checked = savedSettings.toggles.density;
document.getElementById('exclusion-toggle').checked = savedSettings.toggles.exclusion !== false; // Default to true if not set

// Sample data for fallback
const samplePolygon = [
    [-1.305, 36.865],
    [-1.315, 36.875],
    [-1.305, 36.885],
    [-1.295, 36.875]
];

// Load GeoJSON data and provision distribution data
let geoJSONData = null;
let provisionData = null;
let svgDensityGroup = null;

// Define overlapping settlement precedence
const settlementPrecedence = {
    "Moto Moto": ["Buildings"] // Building takes precedence over Moto Moto in overlapping areas
};

// Special density correction factors for settlements that need adjustment
// For nonlinear correction, we'll use: { baseFactor, lowDensityBoost, threshold }
const densityCorrectionFactors = {
    // Vietnam needs to be twice as dense at 100, normal at 400+
    "Vietnam": { 
        baseFactor: 0.9,  // Base factor unchanged (good at 400+)
        lowDensityBoost: 1.2, // Increased for stronger effect at low densities
        threshold: 300  // Start transition at 300
    },
    // Rurie needs to be less dense (0.9x) at 400, but 1.5x at low values
    "Rurie": { 
        baseFactor: 1.0,  // Adjusted base factor
        lowDensityBoost: 0.8, // Modified for appropriate curve
        threshold: 300  // Start transition at 300
    },
    // Riara needs to be 1.5 times denser
    "Riara": { 
        baseFactor: 0.7, // Base factor for general density increase
        lowDensityBoost: 0.3, // Additional boost at low densities
        threshold: 300  // Standard threshold
    }
};

// Function to get settlement group
function getSettlementGroup(name) {
    for (const groupName in settlementGroups) {
        if (settlementGroups[groupName].includes(name)) {
            return groupName;
        }
    }
    return "Mukuru Kwa Reuben"; // Default to Group 2 if not found
}

// Load settings from localStorage
function loadSettings() {
    const defaultSettings = {
        mapStyle: 'standard',
        opacity: 0.7,
        dotSize: 3, // Default dot size (50% larger than original 2px)
        dotDensity: 500, // Default dot density divisor
        groupOpacity: {
            "Mukuru Kwa Njenga": 0.8,
            "Mukuru Kwa Reuben": 0.8
        },
        mapPosition: {
            center: mukuruCoordinates,
            zoom: 14
        },
        toggles: {
            contours: true,
            labels: true,
            icons: true,
            density: true,
            exclusion: true,
            removedTransformers: false, // Toggle for removed transformers
            demolishedTransformers: false // New toggle for demolished transformers
        }
    };
    
    try {
        const savedSettings = JSON.parse(localStorage.getItem('mukuruMapSettings'));
        
        // Ensure group opacity values are within new range if loaded from old version
        if (savedSettings && savedSettings.groupOpacity) {
            if (savedSettings.groupOpacity["Mukuru Kwa Njenga"] > 0.8) {
                savedSettings.groupOpacity["Mukuru Kwa Njenga"] = 0.8;
            }
            if (savedSettings.groupOpacity["Mukuru Kwa Reuben"] > 0.8) {
                savedSettings.groupOpacity["Mukuru Kwa Reuben"] = 0.8;
            }
        }
        
        // Ensure the transformer toggles exist
        if (savedSettings && savedSettings.toggles) {
            if (typeof savedSettings.toggles.removedTransformers === 'undefined') {
                savedSettings.toggles.removedTransformers = false;
            }
            if (typeof savedSettings.toggles.demolishedTransformers === 'undefined') {
                savedSettings.toggles.demolishedTransformers = false;
            }
        }
        
        return savedSettings || defaultSettings;
    } catch (e) {
        console.error('Error loading settings from localStorage:', e);
        return defaultSettings;
    }
}

// Save settings to localStorage
function saveSettings() {
    const densityIndex = parseInt(document.getElementById('dot-density-slider').value);
    const densityValue = densityValues[densityIndex];
    
    const settings = {
        mapStyle: map.hasLayer(satelliteLayer) ? 'satellite' : 'standard',
        opacity: parseFloat(document.getElementById('opacity-slider').value),
        dotSize: parseFloat(document.getElementById('dot-size-slider').value),
        dotDensity: densityValue, // Save the actual value, not the index
        groupOpacity: {
            "Mukuru Kwa Njenga": parseFloat(document.getElementById('njenga-opacity-slider').value),
            "Mukuru Kwa Reuben": parseFloat(document.getElementById('reuben-opacity-slider').value)
        },
        mapPosition: {
            center: [map.getCenter().lat, map.getCenter().lng],
            zoom: map.getZoom()
        },
        toggles: {
            contours: document.getElementById('contours-toggle').checked,
            labels: document.getElementById('labels-toggle').checked,
            icons: document.getElementById('icons-toggle').checked,
            density: document.getElementById('density-toggle').checked,
            exclusion: document.getElementById('exclusion-toggle').checked,
            removedTransformers: document.getElementById('removed-transformers-toggle').checked,
            demolishedTransformers: document.getElementById('demolished-transformers-toggle').checked // Add new toggle
        }
    };
    
    try {
        localStorage.setItem('mukuruMapSettings', JSON.stringify(settings));
    } catch (e) {
        console.error('Error saving settings to localStorage:', e);
    }
}

// Extract description text from HTML content
function extractDescription(htmlContent) {
    if (!htmlContent) return 'Unnamed Area';
    
    // Simple regex to extract text between <b> tags
    const match = htmlContent.match(/<b[^>]*>([^<]+)<\/b>/);
    if (match && match[1]) {
        return match[1].trim();
    }
    
    // Fallback: strip all HTML tags
    return htmlContent.replace(/<[^>]*>/g, '').trim() || 'Unnamed Area';
}

// Save map position on move end
map.on('moveend', function() {
    saveSettings();
});

// Initialize layers
function initializeContours() {
    if (!geoJSONData) return;
    
    // Create contour lines around each polygon
    const polygonFeatures = geoJSONData.features.filter(feature => 
        feature.geometry && feature.geometry.type === 'Polygon'
    );
    
    polygonFeatures.forEach((feature, index) => {
        const coordinates = feature.geometry.coordinates[0];
        
        // Find the closest point label to this polygon to determine its name
        const centroidLat = coordinates.reduce((sum, coord) => sum + coord[1], 0) / coordinates.length;
        const centroidLng = coordinates.reduce((sum, coord) => sum + coord[0], 0) / coordinates.length;
        
        const pointFeatures = geoJSONData.features.filter(f => 
            f.geometry && f.geometry.type === 'Point' && 
            f.properties && f.properties.description
        );
        
        let closestPoint = null;
        let minDistance = Infinity;
        
        pointFeatures.forEach(point => {
            const pointCoord = point.geometry.coordinates;
            const distance = Math.sqrt(
                Math.pow(centroidLat - pointCoord[1], 2) + 
                Math.pow(centroidLng - pointCoord[0], 2)
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                closestPoint = point;
            }
        });
        
        let areaName = `Area ${index + 1}`;
        if (closestPoint && minDistance < 0.01) {
            areaName = extractDescription(closestPoint.properties.description);
        }
        
        // Create a Turf polygon from the GeoJSON coordinates
        const turfPolygon = turf.polygon([[...coordinates, coordinates[0]]]);
        
        // Subtract exclusion zones if they exist
        let finalPolygon = turfPolygon;
        if (window.exclusionGeoJSON && document.getElementById('exclusion-toggle').checked) {
            const exclusions = window.exclusionGeoJSON.features.filter(f => 
                f.geometry && f.geometry.type === 'Polygon'
            );
            
            // Subtract each exclusion zone from the polygon
            exclusions.forEach(exclusion => {
                const exclusionPolygon = turf.polygon([exclusion.geometry.coordinates[0]]);
                try {
                    const diff = turf.difference(finalPolygon, exclusionPolygon);
                    if (diff) {
                        finalPolygon = diff;
                    }
                } catch (e) {
                    console.error('Error performing polygon difference:', e);
                }
            });
        }
        
        // Convert the resulting Turf geometry back to Leaflet format
        let leafletCoords = [];
        
        // Handle both Polygon and MultiPolygon results from the difference operation
        if (finalPolygon.geometry.type === 'Polygon') {
            // Single polygon result
            leafletCoords = finalPolygon.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
            
            // Create a simplified contour line from the polygon
            const polyline = L.polyline(leafletCoords, {
                color: getSettlementColor(areaName),
                weight: 2,
                opacity: 1,
                className: `contour contour-${areaName.replace(/\s+/g, '-').toLowerCase()}`
            }).addTo(contoursLayer);
            
            // Store reference to contour by settlement name
            if (!settlementFeatures[areaName]) {
                settlementFeatures[areaName] = { contours: [], labels: [], densityDots: [] };
            }
            settlementFeatures[areaName].contours.push(polyline);
            
            // Add data attribute for group
            polyline._path.setAttribute('data-group', getSettlementGroup(areaName));
        } 
        else if (finalPolygon.geometry.type === 'MultiPolygon') {
            // Multiple polygons result (when exclusion cuts polygon into separate parts)
            finalPolygon.geometry.coordinates.forEach(polygonPart => {
                const partCoords = polygonPart[0].map(coord => [coord[1], coord[0]]);
                
                // Create a polyline for each part
                const polyline = L.polyline(partCoords, {
                    color: getSettlementColor(areaName),
                    weight: 2,
                    opacity: 1,
                    className: `contour contour-${areaName.replace(/\s+/g, '-').toLowerCase()}`
                }).addTo(contoursLayer);
                
                // Store reference to contour by settlement name
                if (!settlementFeatures[areaName]) {
                    settlementFeatures[areaName] = { contours: [], labels: [], densityDots: [] };
                }
                settlementFeatures[areaName].contours.push(polyline);
                
                // Add data attribute for group
                polyline._path.setAttribute('data-group', getSettlementGroup(areaName));
            });
        }
    });
}

function initializeLabels() {
    if (!geoJSONData) return;
    
    // Find point features with descriptions (these are the labels)
    const labelFeatures = geoJSONData.features.filter(feature => 
        feature.geometry && 
        feature.geometry.type === 'Point' && 
        feature.properties && 
        feature.properties.description
    );
    
    labelFeatures.forEach(feature => {
        const coordinates = feature.geometry.coordinates;
        const description = extractDescription(feature.properties.description);
        const rotation = feature.properties.rotation || 0; // Get rotation if it exists
        
        // Create a label with rotation styling if needed
        const labelStyle = rotation ? 
            `transform: rotate(${rotation}deg); transform-origin: center center;` : '';
        
        // Create a label at the point location
        const marker = L.marker([coordinates[1], coordinates[0]], {
            icon: L.divIcon({
                className: `label label-${description.replace(/\s+/g, '-').toLowerCase()}`,
                html: `<div data-group="${getSettlementGroup(description)}" style="${labelStyle}">${description}</div>`,
                iconSize: [120, 20],
                iconAnchor: [60, 10]
            })
        }).addTo(labelsLayer);
        
        // Store reference to label by settlement name
        if (!settlementFeatures[description]) {
            settlementFeatures[description] = { contours: [], labels: [], densityDots: [] };
        }
        settlementFeatures[description].labels.push(marker);
    });
}

// Fix the transformer visibility logic with a direct, simple approach
function initializeTransformers() {
    // Clear existing icons
    iconsLayer.clearLayers();
    
    // Load transformer data from JSON file
    fetch('data/transformers.json')
        .then(response => response.json())
        .then(data => {
            // Get current group opacities
            const groupOpacities = savedSettings.groupOpacity || {
                "Mukuru Kwa Njenga": 0.8,
                "Mukuru Kwa Reuben": 0.8
            };
            
            console.log("Current opacities:", groupOpacities);
            
            // Add each transformer to the map if it meets the criteria
            data.transformers.forEach(transformer => {
                // Check which types of transformers to show
                const showRemovedTransformers = document.getElementById('removed-transformers-toggle').checked;
                const showDemolishedTransformers = document.getElementById('demolished-transformers-toggle').checked;
                
                // Display if: it's a Transformer device AND 
                // (it's Operational OR 
                //  (it's Removed AND we're showing removed) OR
                //  (it's Demolished AND we're showing demolished))
                if (transformer.device === "Transformer" && 
                    (transformer.status === "Operational" || 
                     (transformer.status === "Removed" && showRemovedTransformers) ||
                     (transformer.status === "Demolished" && showDemolishedTransformers))) {
                    
                    // STEP 1: CHECK VILLAGE OPACITY
                    // If transformer is in Mukuru Kwa Reuben and opacity is 0, skip it
                    if (transformer["in-village"] === "Mukuru Kwa Reuben" && 
                        groupOpacities["Mukuru Kwa Reuben"] === 0) {
                        return; // Skip this transformer
                    }
                    
                    // If transformer is in Mukuru Kwa Njenga and opacity is 0, skip it
                    if (transformer["in-village"] === "Mukuru Kwa Njenga" && 
                        groupOpacities["Mukuru Kwa Njenga"] === 0) {
                        return; // Skip this transformer
                    }
                    
                    // Only check exclusion zones for operational and removed transformers
                    // Don't apply the exclusion zone rule to demolished transformers
                    if (transformer.status !== "Demolished" && document.getElementById('exclusion-toggle').checked) {
                        const point = L.latLng(transformer.lat, transformer.lng);
                        if (isPointInExclusionZone(point)) {
                            return; // Skip this transformer
                        }
                    }
                    
                    // Determine bolt color based on status and in-village/out-of-village status
                    let boltColor;
                    
                    if (transformer.status === "Operational") {
                        // For operational transformers, use the in-village/out-of-village logic
                        // Yellow inside, orange outside
                        boltColor = transformer["out-of-village"] && !transformer["in-village"] 
                            ? "#FF8C00" : "#FFD700";
                    } else if (transformer.status === "Removed") {
                        // Gray for removed transformers
                        boltColor = "#888888";
                    } else if (transformer.status === "Demolished") {
                        // Red for demolished transformers
                        boltColor = "#FF0000";
                    }
                    
                    // Create a custom transformer icon using a pole (custom div) + lightning bolt (Font Awesome)
                    const transformerIcon = L.divIcon({
                        className: 'transformer-icon',
                        html: `<div><span class="fa-bar"></span><i class="fa-solid fa-bolt" style="color: ${boltColor};"></i></div>`,
                        iconSize: [40, 40],
                        iconAnchor: [20, 40],  // Align exactly at the bottom of the pole
                        popupAnchor: [0, -40]
                    });
                    
                    // Add marker with custom icon
                    const marker = L.marker([transformer.lat, transformer.lng], {
                        icon: transformerIcon
                    }).bindPopup(`
                        <div class="transformer-popup">
                            <h3>${transformer.id}. ${transformer.name}</h3>
                            <table>
                                <tr>
                                    <td>Status:</td>
                                    <td>${transformer.status}</td>
                                </tr>
                                <tr>
                                    <td>Village:</td>
                                    <td>${transformer["in-village"] || transformer["out-of-village"] || "Unknown"}</td>
                                </tr>
                                <tr>
                                    <td>Type:</td>
                                    <td>${transformer.type}</td>
                                </tr>
                                <tr>
                                    <td>Device:</td>
                                    <td>${transformer.device}</td>
                                </tr>
                            </table>
                        </div>
                    `);
                    
                    marker.addTo(iconsLayer);
                }
            });
        })
        .catch(error => {
            console.error('Error loading transformer data:', error);
            
            // Fallback - add some sample transformers if data fails to load
            initializeTransformers_fallback();
        });
}

// Also update the fallback function with the same opacity logic
function initializeTransformers_fallback() {
    console.log('Using fallback transformer data');
    
    // Sample transformer locations for main settlements
    const sampleTransformers = [
        { id: 1, name: "Sisal", lat: -1.31257272, lng: 36.88417861, status: "Operational", "in-village": "Mukuru Kwa Njenga", "out-of-village": "", device: "Transformer", type: "KPLC" },
        { id: 2, name: "Vietnam", lat: -1.31571733, lng: 36.88221482, status: "Operational", "in-village": "Mukuru Kwa Njenga", "out-of-village": "", device: "Transformer", type: "KPLC" },
        { id: 3, name: "Milimani", lat: -1.31732272, lng: 36.88571341, status: "Operational", "in-village": "", "out-of-village": "Mukuru Kwa Njenga", device: "Transformer", type: "Landlord" },
        { id: 4, name: "Removed Transformer", lat: -1.31492633, lng: 36.88173956, status: "Removed", "in-village": "Mukuru Kwa Njenga", "out-of-village": "", device: "Transformer", type: "KPLC" },
        { id: 5, name: "Demolished Transformer", lat: -1.31782149, lng: 36.88352488, status: "Demolished", "in-village": "Mukuru Kwa Njenga", "out-of-village": "", device: "Transformer", type: "KPLC" },
        { id: 6, name: "Transformer - Rurie", lat: -1.31429822, lng: 36.87107608, status: "Operational", "in-village": "Mukuru Kwa Reuben", "out-of-village": "", device: "Transformer", type: "KPLC" }
    ];
    
    // Get current group opacities
    const groupOpacities = savedSettings.groupOpacity || {
        "Mukuru Kwa Njenga": 0.8,
        "Mukuru Kwa Reuben": 0.8
    };
    
    console.log("Current opacities (fallback):", groupOpacities);
    
    // Add each transformer to the map
    sampleTransformers.forEach(transformer => {
        // Check which types of transformers to show
        const showRemovedTransformers = document.getElementById('removed-transformers-toggle').checked;
        const showDemolishedTransformers = document.getElementById('demolished-transformers-toggle').checked;
        
        // Only display transformers with appropriate criteria
        if (transformer.device === "Transformer" && 
            (transformer.status === "Operational" || 
             (transformer.status === "Removed" && showRemovedTransformers) ||
             (transformer.status === "Demolished" && showDemolishedTransformers))) {
            
            // STEP 1: CHECK VILLAGE OPACITY
            // If transformer is in Mukuru Kwa Reuben and opacity is 0, skip it
            if (transformer["in-village"] === "Mukuru Kwa Reuben" && 
                groupOpacities["Mukuru Kwa Reuben"] === 0) {
                return; // Skip this transformer
            }
            
            // If transformer is in Mukuru Kwa Njenga and opacity is 0, skip it
            if (transformer["in-village"] === "Mukuru Kwa Njenga" && 
                groupOpacities["Mukuru Kwa Njenga"] === 0) {
                return; // Skip this transformer
            }
            
            // Only check exclusion zones for operational and removed transformers
            // Don't apply the exclusion zone rule to demolished transformers
            if (transformer.status !== "Demolished" && document.getElementById('exclusion-toggle').checked) {
                const point = L.latLng(transformer.lat, transformer.lng);
                if (isPointInExclusionZone(point)) {
                    return; // Skip this transformer
                }
            }
            
            // Determine bolt color based on status and in-village/out-of-village status
            let boltColor;
            
            if (transformer.status === "Operational") {
                // For operational transformers, use the in-village/out-of-village logic
                // Yellow inside, orange outside
                boltColor = transformer["out-of-village"] && !transformer["in-village"] 
                    ? "#FF8C00" : "#FFD700";
            } else if (transformer.status === "Removed") {
                // Gray for removed transformers
                boltColor = "#888888";
            } else if (transformer.status === "Demolished") {
                // Red for demolished transformers
                boltColor = "#FF0000";
            }
            
            // Create a custom transformer icon using a pole (custom div) + lightning bolt (Font Awesome)
            const transformerIcon = L.divIcon({
                className: 'transformer-icon',
                html: `<div><span class="fa-bar"></span><i class="fa-solid fa-bolt" style="color: ${boltColor};"></i></div>`,
                iconSize: [40, 40],
                iconAnchor: [20, 40],  // Align exactly at the bottom of the pole
                popupAnchor: [0, -40]
            });
            
            L.marker([transformer.lat, transformer.lng], {
                icon: transformerIcon
            }).bindPopup(`
                <div class="transformer-popup">
                    <h3>${transformer.id}. ${transformer.name}</h3>
                    <table>
                        <tr>
                            <td>Status:</td>
                            <td>${transformer.status}</td>
                        </tr>
                        <tr>
                            <td>Village:</td>
                            <td>${transformer["in-village"] || transformer["out-of-village"] || "Unknown"}</td>
                        </tr>
                        <tr>
                            <td>Type:</td>
                            <td>${transformer.type}</td>
                        </tr>
                        <tr>
                            <td>Device:</td>
                            <td>${transformer.device}</td>
                        </tr>
                    </table>
                </div>
            `).addTo(iconsLayer);
        }
    });
}

// Add CSS for transformer icons
const transformerIconStyle = document.createElement('style');
transformerIconStyle.textContent = `
    .transformer-icon {
        background: none;
        border: none;
    }
    .transformer-icon div {
        position: relative;
        width: 100%;
        height: 100%;
    }
    .transformer-icon .fa-bolt {
        font-size: 18px;
        color: #FFD700;
        position: absolute;
        top: 0;
        right: 8px;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
    }
    .transformer-icon .fa-bar {
        position: absolute;
        bottom: 0;
        left: 18px;
        width: 4px;
        height: 28px;
        background-color: #555;
        border-radius: 1px;
        box-shadow: 1px 1px 2px rgba(0,0,0,0.5);
    }
    .transformer-icon:hover {
        transform: scale(1.1);
        transition: transform 0.2s;
    }
    .transformer-popup h3 {
        margin-top: 0;
        color: #333;
    }
    .transformer-popup table {
        border-collapse: collapse;
        width: 100%;
    }
    .transformer-popup td {
        padding: 4px;
    }
    .transformer-popup td:first-child {
        font-weight: bold;
    }
`;
document.head.appendChild(transformerIconStyle);

// Add a new event listener for the removed transformers toggle
document.addEventListener('DOMContentLoaded', function() {
    // Set initial checkbox state based on saved settings
    document.getElementById('removed-transformers-toggle').checked = savedSettings.toggles.removedTransformers;
    document.getElementById('demolished-transformers-toggle').checked = savedSettings.toggles.demolishedTransformers;
    
    // Add event listeners for the toggles
    document.getElementById('removed-transformers-toggle').addEventListener('change', function() {
        // Reinitialize transformers to reflect the new toggle state
        initializeTransformers();
        saveSettings();
    });
    
    document.getElementById('demolished-transformers-toggle').addEventListener('change', function() {
        // Reinitialize transformers to reflect the new toggle state
        initializeTransformers();
        saveSettings();
    });
    
    // Ensure transformer sub-toggles are disabled if the main toggle is off
    document.getElementById('icons-toggle').addEventListener('change', function() {
        const isEnabled = this.checked;
        const removedToggle = document.getElementById('removed-transformers-toggle');
        const demolishedToggle = document.getElementById('demolished-transformers-toggle');
        
        if (!isEnabled) {
            // If transformers are turned off, hide the icons
            map.removeLayer(iconsLayer);
        } else {
            // If transformers are turned on, show the icons
            map.addLayer(iconsLayer);
        }
        
        // Update sub-toggle states
        removedToggle.disabled = !isEnabled;
        demolishedToggle.disabled = !isEnabled;
        
        // Reinitialize transformers
        initializeTransformers();
        saveSettings();
    });
});

// Function to calculate the center of each settlement based on the GeoJSON data
function calculateSettlementCenters() {
    const centers = {};
    
    if (!geoJSONData || !geoJSONData.features) {
        return centers;
    }
    
    // Find all polygon features (settlements)
    const polygonFeatures = geoJSONData.features.filter(feature => 
        feature.geometry && feature.geometry.type === 'Polygon'
    );
    
    // Find all point features with descriptions (settlement labels)
    const pointFeatures = geoJSONData.features.filter(feature => 
        feature.geometry && 
        feature.geometry.type === 'Point' && 
        feature.properties && 
        feature.properties.description
    );
    
    // Process each polygon
    polygonFeatures.forEach(feature => {
        const coordinates = feature.geometry.coordinates[0];
        
        // Calculate centroid
        let centroidLat = 0, centroidLng = 0;
        coordinates.forEach(coord => {
            centroidLng += coord[0];
            centroidLat += coord[1];
        });
        centroidLat /= coordinates.length;
        centroidLng /= coordinates.length;
        
        // Find the closest point feature to identify this polygon
        let closestPoint = null;
        let minDistance = Infinity;
        
        pointFeatures.forEach(point => {
            const pointCoord = point.geometry.coordinates;
            const distance = Math.sqrt(
                Math.pow(centroidLat - pointCoord[1], 2) + 
                Math.pow(centroidLng - pointCoord[0], 2)
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                closestPoint = point;
            }
        });
        
        // Only proceed if we found a close point
        if (closestPoint && minDistance < 0.01) {
            const settlementName = extractDescription(closestPoint.properties.description);
            
            // Don't place transformers in exclusion zones
            const center = L.latLng(centroidLat, centroidLng);
            if (isPointInExclusionZone(center)) {
                return;
            }
            
            centers[settlementName] = {
                lat: centroidLat,
                lng: centroidLng
            };
        }
    });
    
    return centers;
}

// Function to get proportion of provision types for a settlement
function getProvisionProportion(settlementName, provisionType) {
    if (!provisionData || !provisionData.settlements || 
        typeof provisionData.settlements[settlementName] === 'undefined') {
        return provisionType === "Informal" ? 0.5 : 0.5; // Default to 50/50 if data not found
    }
    
    const informalPercentage = provisionData.settlements[settlementName];
    
    if (provisionType === "Informal") {
        return informalPercentage / 100; // Convert percentage to proportion
    } else {
        return (100 - informalPercentage) / 100; // KPLC is the remainder
    }
}

// Function to update density dots
function initializeDensityDots() {
    if (!geoJSONData) return;
    
    // Add an SVG overlay for the dots
    const svgLayer = L.svg().addTo(map);
    const svg = d3.select(svgLayer._container);
    
    // Create a group for all density dots
    svgDensityGroup = svg.append('g').attr('class', 'density-dots-group');
    
    // Initially hide the group if the density toggle is off
    if (!savedSettings.toggles.density) {
        svgDensityGroup.style('display', 'none');
    }
    
    // Get dot size from settings
    const dotSize = savedSettings.dotSize || 3;
    
    // Find polygon features (settlements)
    const polygonFeatures = geoJSONData.features.filter(feature => 
        feature.geometry && feature.geometry.type === 'Polygon'
    );
    
    // Find related point labels for the polygons
    const pointFeatures = geoJSONData.features.filter(feature => 
        feature.geometry && feature.geometry.type === 'Point' && 
        feature.properties && feature.properties.description
    );
    
    // Create a map of settlement names to their polygon boundaries for faster lookup
    const settlementPolygons = {};
    
    // First pass to create all settlement polygons
    polygonFeatures.forEach((feature, index) => {
        const coordinates = feature.geometry.coordinates[0];
        const latlngs = coordinates.map(coord => [coord[1], coord[0]]);
        
        // Find name for this polygon
        let centroidLat = 0, centroidLng = 0;
        coordinates.forEach(coord => {
            centroidLng += coord[0];
            centroidLat += coord[1];
        });
        centroidLat /= coordinates.length;
        centroidLng /= coordinates.length;
        
        // Find the closest point feature
        let closestPoint = null;
        let minDistance = Infinity;
        
        pointFeatures.forEach(point => {
            const pointCoord = point.geometry.coordinates;
            const distance = Math.sqrt(
                Math.pow(centroidLat - pointCoord[1], 2) + 
                Math.pow(centroidLng - pointCoord[0], 2)
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                closestPoint = point;
            }
        });
        
        let areaName = `Area ${index + 1}`;
        if (closestPoint && minDistance < 0.01) {
            areaName = extractDescription(closestPoint.properties.description);
        }
        
        // Store polygon by name for later use
        settlementPolygons[areaName] = L.polygon(latlngs);
    });
    
    // Process each polygon to create density dots
    polygonFeatures.forEach((feature, index) => {
        const coordinates = feature.geometry.coordinates[0];
        const latlngs = coordinates.map(coord => [coord[1], coord[0]]);
        
        // Find a name for this polygon by looking for a nearby point with description
        let areaName = `Area ${index + 1}`;
        
        // Calculate polygon centroid
        let centroidLat = 0, centroidLng = 0;
        coordinates.forEach(coord => {
            centroidLng += coord[0];
            centroidLat += coord[1];
        });
        centroidLat /= coordinates.length;
        centroidLng /= coordinates.length;
        
        // Find the closest point feature
        let closestPoint = null;
        let minDistance = Infinity;
        
        pointFeatures.forEach(point => {
            const pointCoord = point.geometry.coordinates;
            const distance = Math.sqrt(
                Math.pow(centroidLat - pointCoord[1], 2) + 
                Math.pow(centroidLng - pointCoord[0], 2)
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                closestPoint = point;
            }
        });
        
        // Use the description from the closest point if found and within reasonable distance
        if (closestPoint && minDistance < 0.01) { // Threshold distance
            areaName = extractDescription(closestPoint.properties.description);
        }
        
        // Create a polygon object for point-in-polygon testing
        const polygon = L.polygon(latlngs);
        const bounds = polygon.getBounds();
        const dots = [];
        
        // Calculate polygon area in square meters
        const area = L.GeometryUtil.geodesicArea(latlngs);
        
        // Apply area adjustment if this settlement needs density correction
        let effectiveArea = area;
        if (areaAdjustments[areaName]) {
            effectiveArea = area * areaAdjustments[areaName];
        }
        
        // Calculate approximate exclusion zone overlap area if exclusion zones are active
        let exclusionOverlapPercent = 0;
        if (window.exclusionGeoJSON && document.getElementById('exclusion-toggle').checked) {
            // Estimate the percentage of this settlement covered by exclusion zones
            
            // 1. Count total sample points in the polygon
            const SAMPLE_SIZE = 200; // Number of sample points to check
            let totalSamplePoints = 0;
            let excludedSamplePoints = 0;
            
            // Generate sample points throughout the polygon
            for (let i = 0; i < SAMPLE_SIZE; i++) {
                const lat = bounds.getSouth() + Math.random() * (bounds.getNorth() - bounds.getSouth());
                const lng = bounds.getWest() + Math.random() * (bounds.getEast() - bounds.getWest());
                const point = L.latLng(lat, lng);
                
                // Only count points actually inside the polygon
                if (L.GeometryUtil.isPointInPolygon(point, polygon._latlngs[0])) {
                    totalSamplePoints++;
                    
                    // Check if this sample point is in an exclusion zone
                    if (isPointInExclusionZone(point)) {
                        excludedSamplePoints++;
                    }
                }
            }
            
            // Calculate percentage of area covered by exclusion zones
            if (totalSamplePoints > 0) {
                exclusionOverlapPercent = excludedSamplePoints / totalSamplePoints;
                console.log(`Settlement ${areaName}: Approximately ${Math.round(exclusionOverlapPercent * 100)}% excluded`);
                
                // Reduce effective area by the overlap percentage
                effectiveArea = effectiveArea * (1 - exclusionOverlapPercent);
            }
        }
        
        // Get the density divisor from the slider index
        const densityIndex = parseInt(document.getElementById('dot-density-slider').value);
        const densityDivisor = densityValues[densityIndex];
        
        // Calculate number of dots using effective area
        const numDots = Math.min(Math.floor(effectiveArea / densityDivisor), 10000);
        
        // Check if this settlement should avoid areas where it overlaps with others
        const avoidSettlements = settlementPrecedence[areaName] || [];
        
        // Get provision proportions for this settlement
        const informalProp = getProvisionProportion(areaName, "Informal");
        const kplcProp = getProvisionProportion(areaName, "KPLC");
        
        // Target number of dots for each provision type
        const informalDots = Math.floor(numDots * informalProp);
        const kplcDots = numDots - informalDots;
        
        // Track current counts
        let informalCount = 0;
        let kplcCount = 0;
        
        // Generate dots - ensure they're inside the polygon and respect overlapping precedence
        let attempts = 0;
        while ((informalCount < informalDots || kplcCount < kplcDots) && attempts < numDots * 20) {
            attempts++;
            const lat = bounds.getSouth() + Math.random() * (bounds.getNorth() - bounds.getSouth());
            const lng = bounds.getWest() + Math.random() * (bounds.getEast() - bounds.getWest());
            const point = L.latLng(lat, lng);
            
            // Skip points in exclusion zones
            if (isPointInExclusionZone(point)) {
                continue;
            }
            
            // Skip points outside the settlement
            if (!L.GeometryUtil.isPointInPolygon(point, polygon._latlngs[0])) {
                continue;
            }
            
            // Skip points in settlements with higher precedence
            let skipDueToOverlap = false;
            if (avoidSettlements.length > 0) {
                for (const otherName of avoidSettlements) {
                    if (settlementPolygons[otherName] && 
                        L.GeometryUtil.isPointInPolygon(point, settlementPolygons[otherName]._latlngs[0])) {
                        skipDueToOverlap = true;
                        break;
                    }
                }
            }
            if (skipDueToOverlap) {
                continue;
            }
            
            // Determine which provision type to assign based on current counts
            let provisionType;
            if (informalCount >= informalDots) {
                // Only need KPLC dots now
                provisionType = "KPLC";
            } else if (kplcCount >= kplcDots) {
                // Only need Informal dots now
                provisionType = "Informal";
            } else {
                // Still need both types - decide randomly weighted by remaining proportion
                const remainingInformalProp = (informalDots - informalCount) / 
                    ((informalDots - informalCount) + (kplcDots - kplcCount));
                provisionType = Math.random() < remainingInformalProp ? "Informal" : "KPLC";
            }
            
            // Add the point
            dots.push({
                lat: lat,
                lng: lng,
                provisionType: provisionType
            });
            
            // Update counter
            if (provisionType === "Informal") {
                informalCount++;
            } else {
                kplcCount++;
            }
        }
        
        // If we couldn't place all dots, log a warning
        if (informalCount < informalDots || kplcCount < kplcDots) {
            console.log(`Warning: Could only place ${informalCount + kplcCount}/${informalDots + kplcDots} dots in ${areaName}`);
        }
        
        // Get the settlement group
        const groupName = getSettlementGroup(areaName);
        
        // Store reference to settlement density dots
        if (!settlementFeatures[areaName]) {
            settlementFeatures[areaName] = { contours: [], labels: [], densityDots: [] };
        }
        
        // Function to update dots on map move/zoom
        function updateDots() {
            svgDensityGroup.selectAll(`.density-dot-${index}`).remove();
            
            // Get current dot size
            const currentDotSize = parseFloat(document.getElementById('dot-size-slider').value);
            
            dots.forEach(dot => {
                const point = map.latLngToLayerPoint(L.latLng(dot.lat, dot.lng));
                
                // Final check to make absolutely sure no dots are in exclusion zones
                // This is an extra precaution in case the exclusion was toggled after dots were generated
                if (isPointInExclusionZone(L.latLng(dot.lat, dot.lng))) {
                    return; // Skip this dot
                }
                
                // Get color based on group and provision type
                const dotColor = getSettlementColor(areaName, dot.provisionType);
                
                const circle = svgDensityGroup.append('circle')
                    .attr('class', `density-dot density-dot-${index}`)
                    .attr('cx', point.x)
                    .attr('cy', point.y)
                    .attr('r', currentDotSize)
                    .style('fill', dotColor)
                    .attr('data-group', groupName)
                    .attr('data-settlement', areaName)
                    .attr('data-provision-type', dot.provisionType);
                
                settlementFeatures[areaName].densityDots.push(circle);
            });
        }
        
        // Update dots on map zoom or move
        map.on('moveend', updateDots);
        updateDots(); // Initial draw
    });
}

// Add Geometry Util functions for area calculation (since it's not included in basic Leaflet)
L.GeometryUtil = L.extend(L.GeometryUtil || {}, {
    // Calculate geodesic area of a polygon
    geodesicArea: function(latLngs) {
        let area = 0;
        const len = latLngs.length;
        
        for (let i = 0; i < len; i++) {
            const p1 = latLngs[i];
            const p2 = latLngs[(i + 1) % len];
            
            area += ((p2[1] - p1[1]) * Math.PI / 180) * 
                   (2 + Math.sin(p1[0] * Math.PI / 180) + 
                    Math.sin(p2[0] * Math.PI / 180));
        }
        
        return Math.abs(area * 6378137 * 6378137 / 2);
    },
    
    // Check if a point is inside a polygon
    isPointInPolygon: function(p, polygon) {
        let inside = false;
        const x = p.lng, y = p.lat;
        
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].lng, yi = polygon[i].lat;
            const xj = polygon[j].lng, yj = polygon[j].lat;
            
            const intersect = ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                
            if (intersect) inside = !inside;
        }
        
        return inside;
    }
});

// Create a legend control
function createLegend() {
    const LegendControl = L.Control.extend({
        options: {
            position: 'bottomleft'
        },
        
        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'legend-control');
            container.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
            container.style.padding = '6px 8px';
            container.style.borderRadius = '4px';
            container.style.boxShadow = '0 0 4px rgba(0, 0, 0, 0.3)';
            container.style.lineHeight = '1.8';
            container.style.cursor = 'pointer';
            
            container.innerHTML = '<h4 style="margin: 0 0 8px 0; font-size: 14px;">Electricity</h4>';
            
            // Create legend items for provision types with color pickers
            const provisionTypes = ["Informal", "KPLC"];
            
            provisionTypes.forEach(provisionType => {
                const item = document.createElement('div');
                item.className = 'legend-item';
                item.style.display = 'flex';
                item.style.alignItems = 'center';
                item.style.marginBottom = '8px';
                
                // Create color picker input
                const colorPicker = document.createElement('input');
                colorPicker.type = 'color';
                colorPicker.value = provisionColors[provisionType];
                colorPicker.className = 'color-picker';
                colorPicker.style.width = '24px';
                colorPicker.style.height = '24px';
                colorPicker.style.border = 'none';
                colorPicker.style.padding = '0';
                colorPicker.style.marginRight = '8px';
                colorPicker.style.cursor = 'pointer';
                
                // Handle color changes
                colorPicker.addEventListener('input', function() {
                    // Update color in real-time while picking
                    provisionColors[provisionType] = this.value;
                    
                    // Update the legend item color
                    colorBox.style.backgroundColor = this.value;
                });
                
                colorPicker.addEventListener('change', function() {
                    // Save the final color when picker closes
                    provisionColors[provisionType] = this.value;
                    saveColors();
                    
                    // Redraw all dots with new colors
                    updateColors();
                });
                
                // Create color display box (shows current color)
                const colorBox = document.createElement('span');
                colorBox.style.backgroundColor = provisionColors[provisionType];
                // colorBox.style.width = '16px';
                // colorBox.style.height = '16px';
                // colorBox.style.display = 'inline-block';
                // colorBox.style.marginRight = '8px';
                // colorBox.style.border = '1px solid #ccc';
                
                // Create label
                const label = document.createElement('span');
                label.textContent = provisionType;
                label.style.fontSize = '12px';
                
                // Add color picker (hidden visually but functional)
                item.appendChild(colorPicker);
                
                // Add visible color box that shows current color
                item.appendChild(colorBox);
                item.appendChild(label);
                
                // Add click handler to toggle visibility (use colorBox as target)
                colorBox.style.cursor = 'pointer';
                L.DomEvent.on(colorBox, 'click', function(e) {
                    e.stopPropagation();
                    toggleProvisionTypeOpacity(provisionType);
                });
                
                container.appendChild(item);
            });
            
            // Prevent map click events from propagating when clicking the legend
            L.DomEvent.disableClickPropagation(container);
            
            return container;
        }
    });
    
    return new LegendControl();
}

// Function to update all dots with new colors
function updateColors() {
    if (svgDensityGroup) {
        // Update Informal dots
        svgDensityGroup.selectAll('[data-provision-type="Informal"]')
            .style('fill', provisionColors.Informal);
        
        // Update KPLC dots
        svgDensityGroup.selectAll('[data-provision-type="KPLC"]')
            .style('fill', provisionColors.KPLC);
    }
    
    // Update the percentage bar colors in the UI
    const informalBar = document.getElementById('informal-bar');
    const kplcBar = document.getElementById('kplc-bar');
    
    if (informalBar) informalBar.style.backgroundColor = provisionColors.Informal;
    if (kplcBar) kplcBar.style.backgroundColor = provisionColors.KPLC;
}

// Function to toggle provision type opacity
function toggleProvisionTypeOpacity(provisionType) {
    // Find SVG elements by data-provision-type attribute
    const dots = d3.selectAll(`[data-provision-type="${provisionType}"]`);
    const isActive = !dots.classed('faded');
    
    // Toggle opacity for density dots
    dots.classed('faded', isActive);
    
    if (isActive) {
        // Fade the elements - store original opacity
        dots.each(function() {
            const el = d3.select(this);
            const originalOpacity = el.style("opacity") || "1";
            el.attr("data-original-opacity", originalOpacity)
              .style('opacity', 0.3);
        });
    } else {
        // Restore original opacity
        dots.each(function() {
            const el = d3.select(this);
            const originalOpacity = el.attr("data-original-opacity") || "1";
            el.style('opacity', originalOpacity);
        });
    }
}

// Toggle layer event listeners
document.getElementById('contours-toggle').addEventListener('change', function() {
    if (this.checked) {
        map.addLayer(contoursLayer);
    } else {
        map.removeLayer(contoursLayer);
    }
    saveSettings();
});

document.getElementById('labels-toggle').addEventListener('change', function() {
    if (this.checked) {
        map.addLayer(labelsLayer);
    } else {
        map.removeLayer(labelsLayer);
    }
    saveSettings();
});

document.getElementById('icons-toggle').addEventListener('change', function() {
    if (this.checked) {
        map.addLayer(iconsLayer);
    } else {
        map.removeLayer(iconsLayer);
    }
    saveSettings();
});

document.getElementById('density-toggle').addEventListener('change', function() {
    if (this.checked) {
        map.addLayer(densityLayer);
        // Show density dots
        if (svgDensityGroup) {
            svgDensityGroup.style('display', 'block');
        }
        // Trigger a map move to redraw the dots
        map.fire('moveend');
    } else {
        map.removeLayer(densityLayer);
        // Hide density dots
        if (svgDensityGroup) {
            svgDensityGroup.style('display', 'none');
        }
    }
    saveSettings();
});

// Opacity slider for background map
document.getElementById('opacity-slider').addEventListener('input', function() {
    const opacityValue = parseFloat(this.value);
    
    // Apply opacity to current active base layer
    if (map.hasLayer(standardLayer)) {
        standardLayer.setOpacity(opacityValue);
    }
    if (map.hasLayer(satelliteLayer)) {
        satelliteLayer.setOpacity(opacityValue);
    }
    
    // Update the displayed percentage
    document.getElementById('opacity-value').textContent = `${Math.round(opacityValue * 100)}%`;
    
    // Save settings with a slight delay to avoid too many saves during sliding
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(saveSettings, 300);
});

// Dot size slider 
document.getElementById('dot-size-slider').addEventListener('input', function() {
    const sizeValue = parseFloat(this.value);
    
    // Update the displayed value
    document.getElementById('dot-size-value').textContent = `${sizeValue}px`;
    
    // Update all density dots
    updateAllDensityDots(sizeValue);
    
    // Save settings with a slight delay to avoid too many saves during sliding
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(saveSettings, 300);
});

// Dot density slider
document.getElementById('dot-density-slider').addEventListener('input', function() {
    const densityIndex = parseInt(this.value);
    const densityValue = densityValues[densityIndex];
    
    // Update the displayed label
    document.getElementById('dot-density-label').textContent = densityLabels[densityIndex];
    
    // Save settings with a slight delay to avoid too many saves during sliding
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(function() {
        // Store the actual density value, not the index
        const settings = loadSettings();
        settings.dotDensity = densityValue;
        try {
            localStorage.setItem('mukuruMapSettings', JSON.stringify(settings));
        } catch (e) {
            console.error('Error saving settings to localStorage:', e);
        }
    }, 300);
});

// Apply density changes when slider value changes
document.getElementById('dot-density-slider').addEventListener('change', function() {
    updateDotDensity();
});

// Add event listeners to update the people per dot calculation
document.getElementById('dot-density-slider').addEventListener('input', function() {
    // Update on slider movement for immediate feedback
    setTimeout(updatePeoplePerDot, 50);
});

document.getElementById('density-toggle').addEventListener('change', function() {
    // Update when density dots are toggled
    setTimeout(updatePeoplePerDot, 50);
});

// Also update the people per dot calculation after map loads
map.on('layeradd', function(e) {
    if (e.layer === densityLayer) {
        setTimeout(updatePeoplePerDot, 100);
    }
});

// Function to update dot density
function updateDotDensity() {
    // Remove existing density dots
    if (svgDensityGroup) {
        svgDensityGroup.selectAll('*').remove();
    }
    
    // Clear existing density dots references
    for (const settlement in settlementFeatures) {
        if (settlementFeatures[settlement].densityDots) {
            settlementFeatures[settlement].densityDots = [];
        }
    }
    
    // Redraw density dots with new density
    initializeDensityDots();
    
    // Update people per dot calculation
    updatePeoplePerDot();
}

// Function to calculate and display how many people each dot represents
function updatePeoplePerDot() {
    // Get total number of dots currently on the map
    let totalDots = 0;
    if (svgDensityGroup) {
        totalDots = svgDensityGroup.selectAll('.density-dot').size();
    }
    
    // If no dots are visible, use a theoretical value based on current density
    if (totalDots === 0) {
        const densityIndex = parseInt(document.getElementById('dot-density-slider').value);
        const densityValue = densityValues[densityIndex];
        // Roughly estimate dot count based on density divisor and total area
        totalDots = Math.floor(300000 / densityValue); // Approximate calculation
    }
    
    // Calculate people per dot
    const peoplePerDot = Math.round(populationData.Total / totalDots);
    
    // Display the result
    const dotRepresentation = document.getElementById('dot-representation');
    if (dotRepresentation) {
        dotRepresentation.textContent = `Each dot represents ~${peoplePerDot} people`;
    }
}

// Function to update all density dots with new size
function updateAllDensityDots(size) {
    if (svgDensityGroup) {
        svgDensityGroup.selectAll('.density-dot').attr('r', size);
    }
    
    // If dots aren't showing, trigger a map move to redraw them
    if (document.getElementById('density-toggle').checked) {
        map.fire('moveend');
    }
}

// Handle base layer switch events to ensure opacity is applied to the new layer
map.on('baselayerchange', function(e) {
    baseLayer = e.layer;
    const opacityValue = parseFloat(document.getElementById('opacity-slider').value);
    baseLayer.setOpacity(opacityValue);
    saveSettings();
});

// Add CSS rules for faded elements
const style = document.createElement('style');
style.textContent = `
    .faded {
        opacity: 0.3;
        transition: opacity 0.3s ease;
    }
    
    .leaflet-bottom.leaflet-left {
        display: flex;
        flex-direction: row;
    }
    
    .transformer-legend {
        order: 2; /* Ensures transformer legend comes after electricity legend */
    }
    
    .legend-control:not(.transformer-legend) {
        order: 1; /* Electricity legend comes first */
    }
`;
document.head.appendChild(style);

// Load GeoJSON data and initialize layers
Promise.all([
    fetch('data/mukuru.geojson').then(response => response.json()),
    fetch('data/provision-distribution.json').then(response => response.json())
])
.then(([geoJSONResult, provisionResult]) => {
    geoJSONData = geoJSONResult;
    provisionData = provisionResult;
    
    initializeContours();
    initializeLabels();
    initializeTransformers(); // Replace this
    initializeDensityDots();
    addGroupLabels(); // Add group labels after other elements are drawn
    applyInitialGroupOpacities(); // Apply saved group opacities
    loadExclusionZones(); // Load exclusion zones
    
    // Add legend after data is loaded
    createLegend().addTo(map);
    createTransformerLegend().addTo(map); // Add transformer legend
    
    // Initialize distribution controls
    initializeDistributionControls();
})
.catch(error => {
    console.error('Error loading data:', error);
    alert('Failed to load map data. Using fallback sample data.');
    
    // Fallback to sample data if data fails to load
    initializeContours_fallback();
    initializeLabels_fallback();
    initializeTransformers_fallback(); // Replace this
    initializeDensityDots_fallback();
    addGroupLabels(); // Still add group labels with fallback data
    applyInitialGroupOpacities(); // Apply saved group opacities
    loadExclusionZones(); // Still try to load exclusion zones
    
    // Add legend even with fallback data
    createLegend().addTo(map);
    createTransformerLegend().addTo(map); // Add transformer legend
    
    // Initialize distribution controls with fallback data
    initializeDistributionControls_fallback();
});

// Function to initialize the distribution controls
function initializeDistributionControls() {
    if (!provisionData || !provisionData.settlements) return;
    
    const settlementSelect = document.getElementById('settlement-select');
    const informalSlider = document.getElementById('informal-slider');
    const informalValue = document.getElementById('informal-value');
    const informalPercent = document.getElementById('informal-percent');
    const kplcPercent = document.getElementById('kplc-percent');
    const informalBar = document.getElementById('informal-bar');
    const kplcBar = document.getElementById('kplc-bar');
    const dotRepresentation = document.getElementById('dot-representation');
    
    // Initial calculation for people per dot
    setTimeout(updatePeoplePerDot, 1000); // Delay to ensure dots are rendered
    
    // Populate the settlement dropdown
    const settlements = Object.keys(provisionData.settlements).sort();
    settlements.forEach(settlement => {
        const option = document.createElement('option');
        option.value = settlement;
        option.textContent = settlement;
        settlementSelect.appendChild(option);
    });
    
    // Initialize the slider with the first settlement's value
    if (settlements.length > 0) {
        const firstSettlement = settlements[0];
        const informalPercentage = provisionData.settlements[firstSettlement];
        
        // Update the UI
        updateDistributionUI(informalPercentage);
    }
    
    // Event listener for settlement selection change
    settlementSelect.addEventListener('change', function() {
        const selectedSettlement = this.value;
        const informalPercentage = provisionData.settlements[selectedSettlement];
        
        // Update the UI
        updateDistributionUI(informalPercentage);
    });
    
    // Event listener for slider input (visual update only)
    informalSlider.addEventListener('input', function() {
        const informalPercentage = parseInt(this.value);
        
        // Update visual elements
        informalValue.textContent = `${informalPercentage}%`;
        informalPercent.textContent = `${informalPercentage}%`;
        kplcPercent.textContent = `${100 - informalPercentage}%`;
        informalBar.style.width = `${informalPercentage}%`;
        kplcBar.style.width = `${100 - informalPercentage}%`;
    });
    
    // Event listener for slider change (apply changes when user stops moving slider)
    informalSlider.addEventListener('change', function() {
        const selectedSettlement = settlementSelect.value;
        const informalPercentage = parseInt(this.value);
        
        // Update the data
        provisionData.settlements[selectedSettlement] = informalPercentage;
        
        // Redraw the dots to reflect the new distribution
        updateDistribution();
    });
    
    // Function to update the distribution UI
    function updateDistributionUI(informalPercentage) {
        informalSlider.value = informalPercentage;
        informalValue.textContent = `${informalPercentage}%`;
        informalPercent.textContent = `${informalPercentage}%`;
        kplcPercent.textContent = `${100 - informalPercentage}%`;
        informalBar.style.width = `${informalPercentage}%`;
        kplcBar.style.width = `${100 - informalPercentage}%`;
    }
    
    // Function to update the distribution and redraw the map
    function updateDistribution() {
        // Remove existing density dots
        if (svgDensityGroup) {
            svgDensityGroup.selectAll('*').remove();
        }
        
        // Clear existing density dots references
        for (const settlement in settlementFeatures) {
            if (settlementFeatures[settlement].densityDots) {
                settlementFeatures[settlement].densityDots = [];
            }
        }
        
        // Redraw density dots with new distribution
        initializeDensityDots();
    }
}

// Fallback version for when the data fails to load
function initializeDistributionControls_fallback() {
    const settlementSelect = document.getElementById('settlement-select');
    const informalSlider = document.getElementById('informal-slider');
    const informalValue = document.getElementById('informal-value');
    const informalPercent = document.getElementById('informal-percent');
    const kplcPercent = document.getElementById('kplc-percent');
    const informalBar = document.getElementById('informal-bar');
    const kplcBar = document.getElementById('kplc-bar');
    const updateBtn = document.getElementById('update-distribution-btn');
    
    // Add some fallback settlements
    const fallbackSettlements = ["Mukuru kwa Njenga", "Mukuru kwa Reuben", "Viwandani"];
    
    // Create a fallback data structure if needed
    if (!provisionData) {
        provisionData = {
            settlements: {}
        };
        
        fallbackSettlements.forEach(settlement => {
            provisionData.settlements[settlement] = 50;
        });
    }
    
    // Populate the dropdown
    fallbackSettlements.forEach(settlement => {
        const option = document.createElement('option');
        option.value = settlement;
        option.textContent = settlement;
        settlementSelect.appendChild(option);
    });
    
    // Set up the same event listeners as the main function
    settlementSelect.addEventListener('change', function() {
        const selectedSettlement = this.value;
        const informalPercentage = provisionData.settlements[selectedSettlement] || 50;
        
        updateDistributionUI(informalPercentage);
    });
    
    informalSlider.addEventListener('input', function() {
        const informalPercentage = parseInt(this.value);
        updateDistributionUI(informalPercentage);
    });
    
    updateBtn.addEventListener('click', function() {
        const selectedSettlement = settlementSelect.value;
        const informalPercentage = parseInt(informalSlider.value);
        
        provisionData.settlements[selectedSettlement] = informalPercentage;
        updateDistribution();
    });
    
    // Initialize with the first value
    updateDistributionUI(50);
    
    // Helper functions
    function updateDistributionUI(informalPercentage) {
        informalSlider.value = informalPercentage;
        informalValue.textContent = `${informalPercentage}%`;
        informalPercent.textContent = `${informalPercentage}%`;
        kplcPercent.textContent = `${100 - informalPercentage}%`;
        informalBar.style.width = `${informalPercentage}%`;
        kplcBar.style.width = `${100 - informalPercentage}%`;
    }
    
    function updateDistribution() {
        // For fallback, simply refresh the display
        if (svgDensityGroup) {
            svgDensityGroup.selectAll('*').remove();
        }
        
        // Redraw density dots
        initializeDensityDots_fallback();
    }
}

// Fallback initialization functions using hardcoded data
function initializeContours_fallback() {
    // Create sample contour lines
    for (let i = 0; i < 5; i++) {
        const offset = i * 0.002;
        const contourPolygon = [
            [-1.305 - offset, 36.865 - offset],
            [-1.315 - offset, 36.875 - offset],
            [-1.305 - offset, 36.885 - offset],
            [-1.295 - offset, 36.875 - offset]
        ];
        
        const groupName = i < 3 ? "Mukuru Kwa Njenga" : "Mukuru Kwa Reuben";
        const areaName = i < 3 ? "Mukuru kwa Njenga" : "Mukuru kwa Reuben";
        
        const polyline = L.polyline(contourPolygon, {
            color: getSettlementColor(areaName, "Informal"),  // Use one of the colors
            weight: 2,
            opacity: 0.7,
            className: 'contour'
        }).addTo(contoursLayer);
        
        polyline._path.setAttribute('data-group', groupName);
        
        // Store reference to contour
        if (!settlementFeatures[areaName]) {
            settlementFeatures[areaName] = { contours: [], labels: [], densityDots: [] };
        }
        settlementFeatures[areaName].contours.push(polyline);
    }
}

function initializeLabels_fallback() {
    const sampleLabels = [
        { name: "Mukuru kwa Njenga", lat: -1.3097, lng: 36.8718, group: "Mukuru Kwa Njenga", rotation: 15 },
        { name: "Mukuru kwa Reuben", lat: -1.3150, lng: 36.8600, group: "Mukuru Kwa Reuben" },
        { name: "Viwandani", lat: -1.3050, lng: 36.8650, group: "Mukuru Kwa Reuben", rotation: -10 }
    ];
    
    sampleLabels.forEach(label => {
        // Create a label with rotation styling if needed
        const rotation = label.rotation || 0;
        const labelStyle = rotation ? 
            `transform: rotate(${rotation}deg); transform-origin: center center;` : '';
            
        const marker = L.marker([label.lat, label.lng], {
            icon: L.divIcon({
                className: `label label-${label.name.replace(/\s+/g, '-').toLowerCase()}`,
                html: `<div data-group="${label.group}" style="${labelStyle}">${label.name}</div>`,
                iconSize: [100, 20],
                iconAnchor: [50, 10]
            })
        }).addTo(labelsLayer);
        
        // Store reference to label
        if (!settlementFeatures[label.name]) {
            settlementFeatures[label.name] = { contours: [], labels: [], densityDots: [] };
        }
        settlementFeatures[label.name].labels.push(marker);
    });
}

function initializeTransformers_fallback() {
    console.log('Using fallback transformer data');
    
    // Sample transformer locations for main settlements
    const sampleTransformers = [
        { id: 1, name: "Sisal", lat: -1.31257272, lng: 36.88417861, status: "Operational", "in-village": "Mukuru Kwa Njenga", "out-of-village": "", device: "Transformer", type: "KPLC" },
        { id: 2, name: "Vietnam", lat: -1.31571733, lng: 36.88221482, status: "Operational", "in-village": "Mukuru Kwa Njenga", "out-of-village": "", device: "Transformer", type: "KPLC" },
        { id: 3, name: "Milimani", lat: -1.31732272, lng: 36.88571341, status: "Operational", "in-village": "", "out-of-village": "Mukuru Kwa Njenga", device: "Transformer", type: "Landlord" },
        { id: 4, name: "Removed Transformer", lat: -1.31492633, lng: 36.88173956, status: "Removed", "in-village": "Mukuru Kwa Njenga", "out-of-village": "", device: "Transformer", type: "KPLC" },
        { id: 5, name: "Demolished Transformer", lat: -1.31782149, lng: 36.88352488, status: "Demolished", "in-village": "Mukuru Kwa Njenga", "out-of-village": "", device: "Transformer", type: "KPLC" },
        { id: 6, name: "Transformer - Rurie", lat: -1.31429822, lng: 36.87107608, status: "Operational", "in-village": "Mukuru Kwa Reuben", "out-of-village": "", device: "Transformer", type: "KPLC" }
    ];
    
    // Get current group opacities
    const groupOpacities = savedSettings.groupOpacity || {
        "Mukuru Kwa Njenga": 0.8,
        "Mukuru Kwa Reuben": 0.8
    };
    
    console.log("Current opacities (fallback):", groupOpacities);
    
    // Add each transformer to the map
    sampleTransformers.forEach(transformer => {
        // Check which types of transformers to show
        const showRemovedTransformers = document.getElementById('removed-transformers-toggle').checked;
        const showDemolishedTransformers = document.getElementById('demolished-transformers-toggle').checked;
        
        // Only display transformers with appropriate criteria
        if (transformer.device === "Transformer" && 
            (transformer.status === "Operational" || 
             (transformer.status === "Removed" && showRemovedTransformers) ||
             (transformer.status === "Demolished" && showDemolishedTransformers))) {
            
            // STEP 1: CHECK VILLAGE OPACITY
            // If transformer is in Mukuru Kwa Reuben and opacity is 0, skip it
            if (transformer["in-village"] === "Mukuru Kwa Reuben" && 
                groupOpacities["Mukuru Kwa Reuben"] === 0) {
                return; // Skip this transformer
            }
            
            // If transformer is in Mukuru Kwa Njenga and opacity is 0, skip it
            if (transformer["in-village"] === "Mukuru Kwa Njenga" && 
                groupOpacities["Mukuru Kwa Njenga"] === 0) {
                return; // Skip this transformer
            }
            
            // Only check exclusion zones for operational and removed transformers
            // Don't apply the exclusion zone rule to demolished transformers
            if (transformer.status !== "Demolished" && document.getElementById('exclusion-toggle').checked) {
                const point = L.latLng(transformer.lat, transformer.lng);
                if (isPointInExclusionZone(point)) {
                    return; // Skip this transformer
                }
            }
            
            // Determine bolt color based on status and in-village/out-of-village status
            let boltColor;
            
            if (transformer.status === "Operational") {
                // For operational transformers, use the in-village/out-of-village logic
                // Yellow inside, orange outside
                boltColor = transformer["out-of-village"] && !transformer["in-village"] 
                    ? "#FF8C00" : "#FFD700";
            } else if (transformer.status === "Removed") {
                // Gray for removed transformers
                boltColor = "#888888";
            } else if (transformer.status === "Demolished") {
                // Red for demolished transformers
                boltColor = "#FF0000";
            }
            
            // Create a custom transformer icon using a pole (custom div) + lightning bolt (Font Awesome)
            const transformerIcon = L.divIcon({
                className: 'transformer-icon',
                html: `<div><span class="fa-bar"></span><i class="fa-solid fa-bolt" style="color: ${boltColor};"></i></div>`,
                iconSize: [40, 40],
                iconAnchor: [20, 40],  // Align exactly at the bottom of the pole
                popupAnchor: [0, -40]
            });
            
            L.marker([transformer.lat, transformer.lng], {
                icon: transformerIcon
            }).bindPopup(`
                <div class="transformer-popup">
                    <h3>${transformer.id}. ${transformer.name}</h3>
                    <table>
                        <tr>
                            <td>Status:</td>
                            <td>${transformer.status}</td>
                        </tr>
                        <tr>
                            <td>Village:</td>
                            <td>${transformer["in-village"] || transformer["out-of-village"] || "Unknown"}</td>
                        </tr>
                        <tr>
                            <td>Type:</td>
                            <td>${transformer.type}</td>
                        </tr>
                        <tr>
                            <td>Device:</td>
                            <td>${transformer.device}</td>
                        </tr>
                    </table>
                </div>
            `).addTo(iconsLayer);
        }
    });
}

function initializeDensityDots_fallback() {
    // Create a polygon boundary - don't add to densityLayer, but instead use the contours layer
    const polygon = L.polygon(samplePolygon, {
        color: '#2c3e50',
        fillColor: 'transparent',
        weight: 2,
        className: 'boundary'
    }).addTo(contoursLayer);
    
    // Add an SVG overlay for the dots
    const svgLayer = L.svg().addTo(map);
    const svg = d3.select(svgLayer._container);
    
    // Create a group for all density dots
    svgDensityGroup = svg.append('g').attr('class', 'density-dots-group');
    
    // Initially hide the group if the density toggle is off
    if (!savedSettings.toggles.density) {
        svgDensityGroup.style('display', 'none');
    }
    
    // Get dot size from settings
    const dotSize = savedSettings.dotSize || 3;
    
    // Get dot density from settings
    const densityIndex = parseInt(document.getElementById('dot-density-slider').value);
    const densityDivisor = densityValues[densityIndex];
    
    // Generate random dots within the polygon bounds
    const bounds = polygon.getBounds();
    const dots = [];
    
    // Calculate area to determine appropriate number of dots
    const area = L.GeometryUtil.geodesicArea(polygon._latlngs[0]);
    
    // Equal distribution for sample but respect density
    const totalDots = Math.min(Math.floor(area / densityDivisor), 1000);
    const informalTarget = Math.floor(totalDots / 2);
    const kplcTarget = totalDots - informalTarget;
    
    let informalCount = 0;
    let kplcCount = 0;
    
    // Generate points inside the polygon
    let attempts = 0;
    while ((informalCount < informalTarget || kplcCount < kplcTarget) && attempts < 2000) {
        attempts++;
        const lat = bounds.getSouth() + Math.random() * (bounds.getNorth() - bounds.getSouth());
        const lng = bounds.getWest() + Math.random() * (bounds.getEast() - bounds.getWest());
        const point = L.latLng(lat, lng);
        
        // Determine which provision type to assign based on current counts
        let provisionType;
        if (informalCount >= informalTarget) {
            provisionType = "KPLC";
        } else if (kplcCount >= kplcTarget) {
            provisionType = "Informal";
        } else {
            // Randomly decide which one to assign based on remaining proportion
            const remainingInformalProp = (informalTarget - informalCount) / 
                ((informalTarget - informalCount) + (kplcTarget - kplcCount));
            provisionType = Math.random() < remainingInformalProp ? "Informal" : "KPLC";
        }
        
        // Only add the point if it's inside the polygon
        if (L.GeometryUtil.isPointInPolygon(point, polygon._latlngs[0])) {
            dots.push({
                lat: lat,
                lng: lng,
                provisionType: provisionType
            });
            
            // Update counters
            if (provisionType === "Informal") {
                informalCount++;
            } else {
                kplcCount++;
            }
        }
    }
    
    // Add dots to the map using D3
    function updateDots() {
        svgDensityGroup.selectAll('.density-dot').remove();
        
        // Get current dot size
        const currentDotSize = parseFloat(document.getElementById('dot-size-slider').value);
        
        dots.forEach(dot => {
            const point = map.latLngToLayerPoint(L.latLng(dot.lat, dot.lng));
            // Determine color based on provision type
            const groupName = "Mukuru Kwa Njenga";
            const dotColor = groupColors[groupName][dot.provisionType];
            
            svgDensityGroup.append('circle')
                .attr('class', 'density-dot')
                .attr('cx', point.x)
                .attr('cy', point.y)
                .attr('r', currentDotSize)
                .style('fill', dotColor)
                .attr('data-group', groupName)
                .attr('data-settlement', areaName)
                .attr('data-provision-type', dot.provisionType);
        });
    }
    
    map.on('moveend', updateDots);
    updateDots();
}

// Function to create a sample GeoJSON file for demonstration
function createSampleGeoJSON() {
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "name": "Mukuru Settlement",
                    "population": 100000
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [36.865, -1.305],
                        [36.875, -1.315],
                        [36.885, -1.305],
                        [36.875, -1.295],
                        [36.865, -1.305]
                    ]]
                }
            }
        ]
    };
}

// For future implementation with real data
// fetch('data/mukuru.geojson')
//     .then(response => response.json())
//     .then(data => {
//         // Process real GeoJSON data
//     })
//     .catch(error => {
//         console.error('Error loading GeoJSON:', error);
//     }); 

// Function to get the major settlement for a sub-settlement
function getMajorSettlement(subSettlementName) {
    if (settlementGroups["Mukuru Kwa Njenga"].includes(subSettlementName)) {
        return "Mukuru Kwa Njenga";
    } else if (settlementGroups["Mukuru Kwa Reuben"].includes(subSettlementName)) {
        return "Mukuru Kwa Reuben";
    } else {
        return "Viwandani"; // Default fallback
    }
}

// Coordinates for group labels (centered above each group area)
const groupLabelPositions = {
    "Mukuru Kwa Njenga": [-1.3235, 36.8795],
    "Mukuru Kwa Reuben": [-1.311, 36.872]
};

// Function to add major group labels to the map
function addGroupLabels() {
    // Clear existing group labels
    groupLabelsLayer.clearLayers();
    
    // Add a label for each major settlement group
    for (const groupName in groupLabelPositions) {
        const position = groupLabelPositions[groupName];
        
        // Create a large, prominent label
        L.marker(position, {
            icon: L.divIcon({
                className: 'group-label',
                html: `<div>${groupName}</div>`,
                iconSize: [200, 40],
                iconAnchor: [100, 20]
            })
        }).addTo(groupLabelsLayer);
    }
}

// Add CSS for group labels
const groupLabelStyle = document.createElement('style');
groupLabelStyle.textContent = `
    .group-label {
        background: none;
        border: none;
    }
    .group-label div {
        font-size: 16px;
        font-weight: bold;
        color: #333;
        text-shadow: 2px 2px 3px rgba(255, 255, 255, 0.8),
                    -2px -2px 3px rgba(255, 255, 255, 0.8),
                    2px -2px 3px rgba(255, 255, 255, 0.8),
                    -2px 2px 3px rgba(255, 255, 255, 0.8);
        text-transform: uppercase;
        letter-spacing: 1px;
        pointer-events: none;
    }
`;
document.head.appendChild(groupLabelStyle);

// Add event listeners for group opacity sliders
document.getElementById('njenga-opacity-slider').addEventListener('input', function() {
    const opacityValue = parseFloat(this.value);
    document.getElementById('njenga-opacity-value').textContent = `${Math.round(opacityValue * 100)}%`;
    updateGroupOpacity("Mukuru Kwa Njenga", opacityValue);
    
    // Save settings with a slight delay
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(saveSettings, 300);
});

document.getElementById('reuben-opacity-slider').addEventListener('input', function() {
    const opacityValue = parseFloat(this.value);
    document.getElementById('reuben-opacity-value').textContent = `${Math.round(opacityValue * 100)}%`;
    updateGroupOpacity("Mukuru Kwa Reuben", opacityValue);
    
    // Save settings with a slight delay
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(saveSettings, 300);
});

// Function to update the opacity of a specific group
function updateGroupOpacity(groupName, opacityValue) {
    // 1. Update density dots and contour lines (directly use the opacity value)
    // Find all density dots for this group
    d3.selectAll(`[data-group="${groupName}"][class*="density-dot"]`)
        .style('opacity', opacityValue);
    
    // 2. Calculate label opacity (dots+20%, except when dots=0)
    const labelOpacity = opacityValue === 0 ? 0 : Math.min(opacityValue + 0.2, 1.0);
    
    // Update all settlement elements for this group
    for (const settlement in settlementFeatures) {
        if (getSettlementGroup(settlement) === groupName) {
            // Update contour lines
            settlementFeatures[settlement].contours.forEach(contour => {
                if (contour._path) {
                    contour._path.style.opacity = opacityValue;
                }
            });
            
            // Update labels with the adjusted opacity
            settlementFeatures[settlement].labels.forEach(label => {
                if (label._icon) {
                    label._icon.style.opacity = labelOpacity;
                }
            });
        }
    }
    
    // 3. Update the group label opacity (always fully visible unless completely hidden)
    const groupLabelElements = document.querySelectorAll(`.group-label div`);
    groupLabelElements.forEach(element => {
        if (element.textContent === groupName) {
            element.style.opacity = opacityValue === 0 ? 0 : 1.0;
        }
    });
    
    // 4. Reinitialize transformers to update their visibility based on the new opacity
    initializeTransformers();
}

// Apply initial group opacities
function applyInitialGroupOpacities() {
    if (savedSettings.groupOpacity) {
        // Apply Njenga opacity
        if (typeof savedSettings.groupOpacity["Mukuru Kwa Njenga"] !== 'undefined') {
            updateGroupOpacity("Mukuru Kwa Njenga", savedSettings.groupOpacity["Mukuru Kwa Njenga"]);
        }
        
        // Apply Reuben opacity
        if (typeof savedSettings.groupOpacity["Mukuru Kwa Reuben"] !== 'undefined') {
            updateGroupOpacity("Mukuru Kwa Reuben", savedSettings.groupOpacity["Mukuru Kwa Reuben"]);
        }
    }
}

// Function to load exclusion zones from GeoJSON
function loadExclusionZones() {
    fetch('data/exclude.geojson')
        .then(response => response.json())
        .then(data => {
            // Store the raw exclusion GeoJSON data for point-in-polygon tests
            window.exclusionGeoJSON = data;
            
            // Add the exclusion zones to the map
            const exclusionLayer = L.geoJSON(data, {
                style: {
                    color: '#FF5555',       // Red outline
                    weight: 2,              // Normal border weight
                    opacity: 0.7,           // Normal opacity
                    fillColor: '#FF5555',   // Red fill
                    fillOpacity: 0.3,       // Semi-transparent fill
                    dashArray: '5, 5'       // Dashed pattern
                }
            }).addTo(excludeLayer);
            
            // Add a single "Demolished" label at the center of all exclusion zones
            if (data.features && data.features.length > 0) {
                // Get bounds of the entire exclusion layer
                const bounds = exclusionLayer.getBounds();
                const center = bounds.getCenter();
                
                // Create a label with the same style as settlement labels but in red
                L.marker(center, {
                    icon: L.divIcon({
                        className: 'label label-demolished',
                        html: `<div style="color: #FF5555;">Demolished</div>`,
                        iconSize: [120, 20],
                        iconAnchor: [85, 90]
                    })
                }).addTo(excludeLayer);
            }
            
            console.log('Exclusion zones loaded');
            
            // If exclusion toggle is off, remove the layer
            if (!document.getElementById('exclusion-toggle').checked) {
                map.removeLayer(excludeLayer);
            } else {
                // Force redraw of density dots when exclusion zones load
                updateDotDensity();
            }
        })
        .catch(error => {
            console.error('Error loading exclusion zones:', error);
        });
}

// More reliable point-in-polygon test using Leaflet's contains method
function isPointInExclusionZone(point) {
    // Make sure exclusion zones are loaded and toggle is on
    if (!window.exclusionGeoJSON || !window.exclusionGeoJSON.features || 
        !document.getElementById('exclusion-toggle').checked) {
        return false;
    }
    
    // Get features with polygons
    const exclusionFeatures = window.exclusionGeoJSON.features.filter(f => 
        f.geometry && f.geometry.type === 'Polygon'
    );
    
    // Test against each exclusion zone polygon
    for (const feature of exclusionFeatures) {
        // Convert GeoJSON coordinates to LatLng array
        const coords = feature.geometry.coordinates[0];
        const latLngs = coords.map(coord => L.latLng(coord[1], coord[0]));
        
        // Create a polygon and test if point is inside
        const polygon = L.polygon(latLngs);
        if (polygon.getBounds().contains(point)) {
            // More accurate test after bounds check
            if (L.GeometryUtil.isPointInPolygon(point, latLngs)) {
                console.log('Point excluded:', point);
                return true;
            }
        }
    }
    
    return false;
}

// Add event listener for exclusion zone toggle
document.getElementById('exclusion-toggle').addEventListener('change', function() {
    if (this.checked) {
        map.addLayer(excludeLayer);
    } else {
        map.removeLayer(excludeLayer);
    }
    
    // Regenerate density dots to account for exclusion zones
    if (document.getElementById('density-toggle').checked) {
        console.log("Regenerating dots after exclusion toggle");
        updateDotDensity();
    }
    
    saveSettings();
}); 

// Add this after the existing createLegend function
function createTransformerLegend() {
    const TransformerLegendControl = L.Control.extend({
        options: {
            position: 'bottomleft'
        },
        
        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'legend-control transformer-legend');
            container.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
            container.style.padding = '6px 8px';
            container.style.borderRadius = '4px';
            container.style.boxShadow = '0 0 4px rgba(0, 0, 0, 0.3)';
            container.style.lineHeight = '1.8';
            container.style.marginLeft = '10px'; // Add spacing from the first legend
            container.style.display = 'inline-block'; // Make it inline
            container.style.marginTop = '0'; // Ensure it's at the same vertical position
            container.style.cursor = 'pointer';
            
            // Check if we need to show status columns
            const showRemovedTransformers = document.getElementById('removed-transformers-toggle').checked;
            const showDemolishedTransformers = document.getElementById('demolished-transformers-toggle').checked;
            const showStatusColumn = showRemovedTransformers || showDemolishedTransformers;
            
            // Only set a wider width if we need to show the status column
            if (showStatusColumn) {
                container.style.minWidth = '320px';
            }
            
            container.innerHTML = '<h4 style="margin: 0 0 8px 0; font-size: 14px;">Transformer</h4>';
            
            // Create table layout for the legend items
            const table = document.createElement('table');
            table.style.borderCollapse = 'separate';
            table.style.borderSpacing = '10px 4px';
            
            // Create legend items for transformer locations (first column)
            const locationTypes = [
                { type: "Inside settlement", color: "#FFD700" }, // Yellow
                { type: "Outside settlement", color: "#FF8C00" }  // Dark Orange
            ];
            
            // Create legend items for transformer statuses (second column, if needed)
            const statusTypes = [];
            if (showRemovedTransformers) {
                statusTypes.push({ type: "Removed", color: "#888888" }); // Gray
            }
            if (showDemolishedTransformers) {
                statusTypes.push({ type: "Demolished", color: "#FF0000" }); // Red
            }
            
            // Create the rows
            const row1 = document.createElement('tr');
            const row2 = document.createElement('tr');
            
            // Create the location column (always shown)
            const locationCell1 = createLegendCell(locationTypes[0]);
            const locationCell2 = createLegendCell(locationTypes[1]);
            row1.appendChild(locationCell1);
            row2.appendChild(locationCell2);
            
            // Create the status column (only if needed)
            if (showStatusColumn) {
                if (statusTypes.length > 0) {
                    const statusCell1 = createLegendCell(statusTypes[0]);
                    row1.appendChild(statusCell1);
                }
                
                if (statusTypes.length > 1) {
                    const statusCell2 = createLegendCell(statusTypes[1]);
                    row2.appendChild(statusCell2);
                }
            }
            
            // Add rows to table
            table.appendChild(row1);
            table.appendChild(row2);
            
            // Add table to container
            container.appendChild(table);
            
            // Prevent map click events from propagating when clicking the legend
            L.DomEvent.disableClickPropagation(container);
            
            return container;
        }
    });
    
    // Helper function to create a legend cell with icon and label
    function createLegendCell(item) {
        const cell = document.createElement('td');
        cell.style.whiteSpace = 'nowrap'; // Prevent wrapping
        
        // Create icon representation
        const iconDiv = document.createElement('div');
        iconDiv.style.position = 'relative';
        iconDiv.style.width = '24px';
        iconDiv.style.height = '24px';
        iconDiv.style.display = 'inline-block';
        iconDiv.style.marginRight = '8px';
        
        // The pole
        const pole = document.createElement('span');
        pole.style.position = 'absolute';
        pole.style.bottom = '0';
        pole.style.left = '10px';
        pole.style.width = '3px';
        pole.style.height = '18px';
        pole.style.backgroundColor = '#555';
        pole.style.borderRadius = '1px';
        
        // The bolt
        const bolt = document.createElement('i');
        bolt.className = 'fa-solid fa-bolt';
        bolt.style.position = 'absolute';
        bolt.style.top = '0';
        bolt.style.right = '2px';
        bolt.style.fontSize = '14px';
        bolt.style.color = item.color;
        
        iconDiv.appendChild(pole);
        iconDiv.appendChild(bolt);
        
        // Create label in the same cell
        const label = document.createElement('span');
        label.textContent = item.type;
        label.style.fontSize = '12px';
        label.style.verticalAlign = 'top';
        
        cell.appendChild(iconDiv);
        cell.appendChild(label);
        
        return cell;
    }
    
    return new TransformerLegendControl();
}

// Update transformer toggle event listeners to refresh the legend when toggles change
document.addEventListener('DOMContentLoaded', function() {
    // Set initial checkbox states based on saved settings
    document.getElementById('removed-transformers-toggle').checked = savedSettings.toggles.removedTransformers;
    document.getElementById('demolished-transformers-toggle').checked = savedSettings.toggles.demolishedTransformers;
    
    // Add event listeners for the toggles
    document.getElementById('removed-transformers-toggle').addEventListener('change', function() {
        // Remove existing legend and add it again to refresh
        const oldLegend = document.querySelector('.transformer-legend');
        if (oldLegend) {
            oldLegend.remove();
        }
        createTransformerLegend().addTo(map);
        
        // Reinitialize transformers to reflect the new toggle state
        initializeTransformers();
        saveSettings();
    });
    
    document.getElementById('demolished-transformers-toggle').addEventListener('change', function() {
        // Remove existing legend and add it again to refresh
        const oldLegend = document.querySelector('.transformer-legend');
        if (oldLegend) {
            oldLegend.remove();
        }
        createTransformerLegend().addTo(map);
        
        // Reinitialize transformers to reflect the new toggle state
        initializeTransformers();
        saveSettings();
    });
    
    // Ensure transformer sub-toggles are disabled if the main toggle is off
    document.getElementById('icons-toggle').addEventListener('change', function() {
        const isEnabled = this.checked;
        const removedToggle = document.getElementById('removed-transformers-toggle');
        const demolishedToggle = document.getElementById('demolished-transformers-toggle');
        
        if (!isEnabled) {
            // If transformers are turned off, hide the icons
            map.removeLayer(iconsLayer);
        } else {
            // If transformers are turned on, show the icons
            map.addLayer(iconsLayer);
        }
        
        // Update sub-toggle states
        removedToggle.disabled = !isEnabled;
        demolishedToggle.disabled = !isEnabled;
        
        // Update the legend as well
        const oldLegend = document.querySelector('.transformer-legend');
        if (oldLegend) {
            oldLegend.remove();
        }
        if (isEnabled) {
            createTransformerLegend().addTo(map);
        }
        
        // Reinitialize transformers
        initializeTransformers();
        saveSettings();
    });
});