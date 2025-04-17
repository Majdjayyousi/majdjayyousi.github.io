// Initialize the map centered on Mukuru, Nairobi
const mukuruCoordinates = [-1.3097, 36.8718]; // Approximate coordinates for Mukuru

// Load saved settings from localStorage or use defaults
const savedSettings = loadSettings();

// Check if URL has parameters to override saved settings
const urlSettings = parseUrlParams();
const activeSettings = urlSettings || savedSettings;

const map = L.map('map', {
    attributionControl: false, // Remove attribution control
    zoomDelta: 0.17, // Smaller zoom increments (approximately 1/6 of default)
    zoomSnap: 0.1  // Allow for fractional zoom levels with 0.1 precision
}).setView(
    activeSettings.mapPosition?.center || mukuruCoordinates, 
    activeSettings.mapPosition?.zoom || 14
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
document.getElementById('cluster-dots-toggle').checked = savedSettings.toggles.clusterDots || false; // Default to false if not set

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
            demolishedTransformers: false, // Toggle for demolished transformers
            estimatedTransformers: true, // Toggle for estimated transformers
            clusterDots: false // Toggle for clustering dots around transformers
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
            if (typeof savedSettings.toggles.estimatedTransformers === 'undefined') {
                savedSettings.toggles.estimatedTransformers = true; // Default to showing estimated transformers
            }
            if (typeof savedSettings.toggles.clusterDots === 'undefined') {
                savedSettings.toggles.clusterDots = false; // Default to not clustering dots
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
            demolishedTransformers: document.getElementById('demolished-transformers-toggle').checked,
            estimatedTransformers: document.getElementById('estimated-transformers-toggle').checked,
            clusterDots: document.getElementById('cluster-dots-toggle').checked
        }
    };
    
    try {
        localStorage.setItem('mukuruMapSettings', JSON.stringify(settings));
        
        // Update URL parameters
        updateUrlParams(settings);
    } catch (e) {
        console.error('Error saving settings to localStorage:', e);
    }
}

// Function to parse URL parameters and override saved settings
function parseUrlParams() {
    const urlSearchParams = new URLSearchParams(window.location.search);
    if (urlSearchParams.size === 0) return null;
    
    try {
        const settings = {
            mapStyle: urlSearchParams.get('style') || 'standard',
            opacity: parseFloat(urlSearchParams.get('opacity')) || 0.7,
            dotSize: parseFloat(urlSearchParams.get('dotSize')) || 3,
            dotDensity: parseInt(urlSearchParams.get('dotDensity')) || 100,
            groupOpacity: {
                "Mukuru Kwa Njenga": parseFloat(urlSearchParams.get('njengaOpacity')) || 0.8,
                "Mukuru Kwa Reuben": parseFloat(urlSearchParams.get('reubenOpacity')) || 0.8
            },
            mapPosition: {
                center: urlSearchParams.get('center') ? 
                    urlSearchParams.get('center').split(',').map(c => parseFloat(c)) : 
                    mukuruCoordinates,
                zoom: parseFloat(urlSearchParams.get('zoom')) || 14
            },
            toggles: {
                contours: urlSearchParams.get('contours') !== 'false',
                labels: urlSearchParams.get('labels') !== 'false',
                icons: urlSearchParams.get('icons') !== 'false',
                density: urlSearchParams.get('density') !== 'false',
                exclusion: urlSearchParams.get('exclusion') !== 'false',
                removedTransformers: urlSearchParams.get('removedTransformers') === 'true',
                demolishedTransformers: urlSearchParams.get('demolishedTransformers') === 'true',
                estimatedTransformers: urlSearchParams.get('estimatedTransformers') !== 'false',
                clusterDots: urlSearchParams.get('clusterDots') === 'true'
            },
            distribution: {
                settlement: urlSearchParams.get('settlement') || '',
                informal: parseInt(urlSearchParams.get('informal')) || 50
            }
        };
        
        return settings;
    } catch (e) {
        console.error('Error parsing URL parameters:', e);
        return null;
    }
}

// Function to update URL parameters without reloading the page
function updateUrlParams(settings) {
    const urlParams = new URLSearchParams();
    
    // Add map style
    urlParams.set('style', settings.mapStyle);
    
    // Add opacity
    urlParams.set('opacity', settings.opacity.toString());
    
    // Add dot settings
    urlParams.set('dotSize', settings.dotSize.toString());
    urlParams.set('dotDensity', settings.dotDensity.toString());
    
    // Add group opacities
    urlParams.set('njengaOpacity', settings.groupOpacity["Mukuru Kwa Njenga"].toString());
    urlParams.set('reubenOpacity', settings.groupOpacity["Mukuru Kwa Reuben"].toString());
    
    // Add map position
    urlParams.set('center', `${settings.mapPosition.center[0]},${settings.mapPosition.center[1]}`);
    urlParams.set('zoom', settings.mapPosition.zoom.toString());
    
    // Add toggle states
    Object.entries(settings.toggles).forEach(([key, value]) => {
        urlParams.set(key, value.toString());
    });
    
    // Add current distribution data if available
    if (provisionData && provisionData.settlements) {
        // Add current selected settlement
        const selectedSettlement = document.getElementById('settlement-select').value;
        if (selectedSettlement) {
            urlParams.set('settlement', selectedSettlement);
        }
        
        // Add current informal percentage
        const informalPercentage = parseInt(document.getElementById('informal-slider').value);
        if (!isNaN(informalPercentage)) {
            urlParams.set('informal', informalPercentage.toString());
        }
    }
    
    // Update URL without refreshing page
    const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
    window.history.replaceState({ path: newUrl }, '', newUrl);
}

// Apply URL or saved settings to UI controls
function applySettings(settings) {
    // Apply map style
    if (settings.mapStyle === 'satellite') {
        if (!map.hasLayer(satelliteLayer)) {
            map.removeLayer(standardLayer);
            map.addLayer(satelliteLayer);
        }
    } else {
        if (!map.hasLayer(standardLayer)) {
            map.removeLayer(satelliteLayer);
            map.addLayer(standardLayer);
        }
    }
    
    // Apply opacity
    const opacitySlider = document.getElementById('opacity-slider');
    opacitySlider.value = settings.opacity;
    document.getElementById('opacity-value').textContent = `${Math.round(settings.opacity * 100)}%`;
    if (map.hasLayer(standardLayer)) {
        standardLayer.setOpacity(settings.opacity);
    }
    if (map.hasLayer(satelliteLayer)) {
        satelliteLayer.setOpacity(settings.opacity);
    }
    
    // Apply dot size
    const dotSizeSlider = document.getElementById('dot-size-slider');
    dotSizeSlider.value = settings.dotSize;
    document.getElementById('dot-size-value').textContent = `${settings.dotSize}px`;
    
    // Apply dot density
    const densityIndex = densityValues.findIndex(v => v >= settings.dotDensity);
    document.getElementById('dot-density-slider').value = densityIndex >= 0 ? densityIndex : 2;
    document.getElementById('dot-density-label').textContent = densityLabels[densityIndex >= 0 ? densityIndex : 2];
    
    // Apply group opacities
    const njengaOpacitySlider = document.getElementById('njenga-opacity-slider');
    njengaOpacitySlider.value = settings.groupOpacity["Mukuru Kwa Njenga"];
    document.getElementById('njenga-opacity-value').textContent = `${Math.round(settings.groupOpacity["Mukuru Kwa Njenga"] * 100)}%`;
    
    const reubenOpacitySlider = document.getElementById('reuben-opacity-slider');
    reubenOpacitySlider.value = settings.groupOpacity["Mukuru Kwa Reuben"];
    document.getElementById('reuben-opacity-value').textContent = `${Math.round(settings.groupOpacity["Mukuru Kwa Reuben"] * 100)}%`;
    
    // Apply toggle states
    document.getElementById('contours-toggle').checked = settings.toggles.contours;
    document.getElementById('labels-toggle').checked = settings.toggles.labels;
    document.getElementById('icons-toggle').checked = settings.toggles.icons;
    document.getElementById('density-toggle').checked = settings.toggles.density;
    document.getElementById('exclusion-toggle').checked = settings.toggles.exclusion;
    document.getElementById('removed-transformers-toggle').checked = settings.toggles.removedTransformers;
    document.getElementById('demolished-transformers-toggle').checked = settings.toggles.demolishedTransformers;
    document.getElementById('estimated-transformers-toggle').checked = settings.toggles.estimatedTransformers;
    document.getElementById('cluster-dots-toggle').checked = settings.toggles.clusterDots;
    
    // Apply toggle disabled states
    const isIconsEnabled = settings.toggles.icons;
    document.getElementById('removed-transformers-toggle').disabled = !isIconsEnabled;
    document.getElementById('demolished-transformers-toggle').disabled = !isIconsEnabled;
    document.getElementById('estimated-transformers-toggle').disabled = !isIconsEnabled;
    
    // Apply distribution settings if provided and elements exist
    if (settings.distribution && provisionData && provisionData.settlements) {
        const settlementSelect = document.getElementById('settlement-select');
        const informalSlider = document.getElementById('informal-slider');
        
        // Once provisionData is loaded, apply the settlement selection
        if (settings.distribution.settlement && settlementSelect) {
            // Wait for settlement options to be populated
            setTimeout(() => {
                // Check if the selected settlement exists in the dropdown
                const optionExists = Array.from(settlementSelect.options).some(
                    option => option.value === settings.distribution.settlement
                );
                
                if (optionExists) {
                    settlementSelect.value = settings.distribution.settlement;
                    
                    // Apply informal percentage if provided
                    if (settings.distribution.informal !== undefined && informalSlider) {
                        informalSlider.value = settings.distribution.informal;
                        
                        // Update visual elements
                        const informalPercentage = settings.distribution.informal;
                        document.getElementById('informal-value').textContent = `${informalPercentage}%`;
                        document.getElementById('informal-percent').textContent = `${informalPercentage}%`;
                        document.getElementById('kplc-percent').textContent = `${100 - informalPercentage}%`;
                        document.getElementById('informal-bar').style.width = `${informalPercentage}%`;
                        document.getElementById('kplc-bar').style.width = `${100 - informalPercentage}%`;
                        
                        // Update the data in provisionData
                        provisionData.settlements[settings.distribution.settlement] = informalPercentage;
                        
                        // Redraw the dots after a short delay to ensure everything is loaded
                        setTimeout(updateDotDensity, 500);
                    }
                }
            }, 1000); // Wait for UI to be fully initialized
        }
    }
}

// If we have URL parameters, apply them to the UI
if (urlSettings) {
    applySettings(urlSettings);
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
        
        // Get area name directly from polygon's properties
        let areaName = `Area ${index + 1}`; // Default fallback name
        
        // Extract the id from the polygon's properties
        if (feature.properties && feature.properties.id) {
            areaName = feature.properties.id;
        } else {
            // Fallback to the old method if id property is not available
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
            
            if (closestPoint && minDistance < 0.01) {
                areaName = extractDescription(closestPoint.properties.description);
            }
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

// Update the initializeTransformers function to handle complex visibility rules
function initializeTransformers() {
    // Clear existing icons
    iconsLayer.clearLayers();
    
    // Load transformer data from JSON file
    fetch('data/transformers.json')
        .then(response => response.json())
        .then(data => {
            // Add each transformer to the map if it meets the criteria
            data.transformers.forEach(transformer => {
                // Check which types of transformers to show
                const showRemovedTransformers = document.getElementById('removed-transformers-toggle').checked;
                const showDemolishedTransformers = document.getElementById('demolished-transformers-toggle').checked;
                const showEstimatedTransformers = document.getElementById('estimated-transformers-toggle').checked; // NEW: Check estimated toggle
                
                // Check if this is an estimated transformer that should be hidden
                if (transformer.type === "Estimated" && !showEstimatedTransformers) {
                    return; // Skip this transformer if it's estimated and toggle is off
                }
                
                // Check if transformer has in-village and out-of-village attributes
                const hasInVillage = transformer["in-village"] && transformer["in-village"].trim() !== "";
                const hasOutOfVillage = transformer["out-of-village"] && transformer["out-of-village"].trim() !== "";
                
                // Check group opacity for in-village
                const inVillageGroup = transformer["in-village"];
                let inVillageOpacity = 1.0; // Default opacity
                
                if (inVillageGroup === "Mukuru Kwa Njenga") {
                    inVillageOpacity = parseFloat(document.getElementById('njenga-opacity-slider').value);
                } else if (inVillageGroup === "Mukuru Kwa Reuben") {
                    inVillageOpacity = parseFloat(document.getElementById('reuben-opacity-slider').value);
                }
                
                // Check group opacity for out-of-village (if it's one of our tracked groups)
                const outOfVillageGroup = transformer["out-of-village"];
                let outOfVillageOpacity = 1.0; // Default to visible
                
                if (hasOutOfVillage) {
                    if (outOfVillageGroup === "Mukuru Kwa Njenga") {
                        outOfVillageOpacity = parseFloat(document.getElementById('njenga-opacity-slider').value);
                    } else if (outOfVillageGroup === "Mukuru Kwa Reuben") {
                        outOfVillageOpacity = parseFloat(document.getElementById('reuben-opacity-slider').value);
                    }
                }
                
                // Determine visibility based on rules:
                // 1. Hide if it has no out-of-village attribute and in-village opacity is 0
                // 2. Hide if both in-village and out-of-village opacities are 0
                // 3. Hide if it has ONLY out-of-village attribute (no in-village) and out-of-village opacity is 0
                // 4. Show otherwise
                const hideTransformer = 
                    (inVillageOpacity === 0 && !hasOutOfVillage) || 
                    (inVillageOpacity === 0 && hasOutOfVillage && outOfVillageOpacity === 0) ||
                    (!hasInVillage && hasOutOfVillage && outOfVillageOpacity === 0);
                
                if (hideTransformer) {
                    return; // Skip this transformer
                }
                
                // Display if: it's a Transformer device AND 
                // (it's Operational OR 
                //  (it's Removed AND we're showing removed) OR
                //  (it's Demolished AND we're showing demolished))
                if (transformer.device === "Transformer" && 
                    (transformer.status === "Operational" || 
                     (transformer.status === "Removed" && showRemovedTransformers) ||
                     (transformer.status === "Demolished" && showDemolishedTransformers))) {
                    
                    // Only check exclusion zones for operational and removed transformers
                    // Don't apply the exclusion zone rule to demolished transformers
                    if (transformer.status !== "Demolished" && document.getElementById('exclusion-toggle').checked) {
                        const point = L.latLng(transformer.lat, transformer.lng);
                        if (isPointInExclusionZone(point)) {
                            console.log(`Skipping transformer in exclusion zone: ${transformer.name}`);
                            return;
                        }
                    }
                    
                    // Determine bolt color based on status and in-village/out-of-village status
                    let boltColor;
                    
                    if (transformer.status === "Operational") {
                        // Special case: If in-village opacity is 0 but out-of-village opacity is not 0,
                        // then show as out-of-village regardless of in-village status
                        if (inVillageOpacity === 0 && hasOutOfVillage && outOfVillageOpacity > 0) {
                            boltColor = "#FF8C00"; // Orange for out-of-village
                        } else {
                            // Otherwise, if both are present, prioritize in-village
                            boltColor = (hasOutOfVillage && !hasInVillage) ? "#FF8C00" : "#FFD700"; // Orange if ONLY out-of-village, yellow otherwise
                        }
                    } else if (transformer.status === "Removed") {
                        // Gray for removed transformers
                        boltColor = "#888888";
                    } else if (transformer.status === "Demolished") {
                        // Red for demolished transformers
                        boltColor = "#FF0000";
                    }
                    
                    // Special styling for estimated transformers
                    let estimatedClass = "";
                    if (transformer.type === "Estimated") {
                        estimatedClass = "estimated-transformer";
                    }
                    
                    // Create a custom transformer icon using a pole (custom div) + lightning bolt (Font Awesome)
                    const transformerIcon = L.divIcon({
                        className: `transformer-icon ${estimatedClass}`,
                        html: `<div><span class="fa-bar"></span><i class="fa-solid fa-bolt ${estimatedClass}" style="color: ${boltColor};"></i></div>`,
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
                                    <td>${transformer["in-village"]}</td>
                                </tr>
                                <tr>
                                    <td>Type:</td>
                                    <td>${transformer.type}</td>
                                </tr>
                                <tr>
                                    <td>Device:</td>
                                    <td>${transformer.device}</td>
                                </tr>
                                ${hasOutOfVillage ? `<tr><td>Serves:</td><td>${transformer["out-of-village"]}</td></tr>` : ''}
                            </table>
                        </div>
                    `);
                    
                    marker.addTo(iconsLayer);
                }
            });
            
            console.log('Transformers loaded');
        })
        .catch(error => {
            console.error('Error loading transformer data:', error);
            
            // Fallback - add some sample transformers if data fails to load
            initializeTransformers_fallback();
        });
}

// Update the CSS for transformer icons to include estimated style
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
    .transformer-icon .fa-bolt.estimated-transformer {
        border: 1px dotted black;
        padding: 2px;
        border-radius: 50%;
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

// Update the fallback function too for consistency
function initializeTransformers_fallback() {
    console.log('Using fallback transformer data');
    
    // Sample transformer locations for main settlements
    const sampleTransformers = [
        { id: 1, name: "Sisal", lat: -1.31257272, lng: 36.88417861, status: "Operational", "in-village": "Mukuru Kwa Njenga", "out-of-village": "", device: "Transformer", type: "KPLC" },
        { id: 2, name: "Vietnam", lat: -1.31571733, lng: 36.88221482, status: "Operational", "in-village": "Mukuru Kwa Njenga", "out-of-village": "", device: "Transformer", type: "KPLC" },
        { id: 3, name: "Milimani", lat: -1.31732272, lng: 36.88571341, status: "Operational", "in-village": "Mukuru Kwa Njenga", "out-of-village": "", device: "Transformer", type: "Landlord" },
        { id: 4, name: "Removed Transformer", lat: -1.31492633, lng: 36.88173956, status: "Removed", "in-village": "Mukuru Kwa Njenga", "out-of-village": "", device: "Transformer", type: "KPLC" },
        { id: 5, name: "Demolished Transformer", lat: -1.31782149, lng: 36.88352488, status: "Demolished", "in-village": "Mukuru Kwa Njenga", "out-of-village": "", device: "Transformer", type: "KPLC" },
        { id: 6, name: "Out-of-village Transformer", lat: -1.31300000, lng: 36.88000000, status: "Operational", "in-village": "", "out-of-village": "External Area", device: "Transformer", type: "KPLC" },
        { id: 7, name: "Both In & Out Transformer", lat: -1.31400000, lng: 36.88100000, status: "Operational", "in-village": "Mukuru Kwa Njenga", "out-of-village": "Mukuru Kwa Reuben", device: "Transformer", type: "KPLC" },
        { id: "E1", name: "Estimated Transformer", lat: -1.31600000, lng: 36.88200000, status: "Operational", "in-village": "Mukuru Kwa Njenga", "out-of-village": "", device: "Transformer", type: "Estimated" }
    ];
    
    // Add each transformer to the map
    sampleTransformers.forEach(transformer => {
        // Check which types of transformers to show
        const showRemovedTransformers = document.getElementById('removed-transformers-toggle').checked;
        const showDemolishedTransformers = document.getElementById('demolished-transformers-toggle').checked;
        const showEstimatedTransformers = document.getElementById('estimated-transformers-toggle').checked; // NEW: Check estimated toggle
        
        // Check if this is an estimated transformer that should be hidden
        if (transformer.type === "Estimated" && !showEstimatedTransformers) {
            return; // Skip this transformer if it's estimated and toggle is off
        }
        
        // Check if transformer has in-village and out-of-village attributes
        const hasInVillage = transformer["in-village"] && transformer["in-village"].trim() !== "";
        const hasOutOfVillage = transformer["out-of-village"] && transformer["out-of-village"].trim() !== "";
        
        // Check group opacity for in-village
        const inVillageGroup = transformer["in-village"];
        let inVillageOpacity = 1.0; // Default opacity
        
        if (inVillageGroup === "Mukuru Kwa Njenga") {
            inVillageOpacity = parseFloat(document.getElementById('njenga-opacity-slider').value);
        } else if (inVillageGroup === "Mukuru Kwa Reuben") {
            inVillageOpacity = parseFloat(document.getElementById('reuben-opacity-slider').value);
        }
        
        // Check group opacity for out-of-village (if it's one of our tracked groups)
        const outOfVillageGroup = transformer["out-of-village"];
        let outOfVillageOpacity = 1.0; // Default to visible
        
        if (hasOutOfVillage) {
            if (outOfVillageGroup === "Mukuru Kwa Njenga") {
                outOfVillageOpacity = parseFloat(document.getElementById('njenga-opacity-slider').value);
            } else if (outOfVillageGroup === "Mukuru Kwa Reuben") {
                outOfVillageOpacity = parseFloat(document.getElementById('reuben-opacity-slider').value);
            }
        }
        
        // Determine visibility based on rules:
        // 1. Hide if it has no out-of-village attribute and in-village opacity is 0
        // 2. Hide if both in-village and out-of-village opacities are 0
        // 3. Hide if it has ONLY out-of-village attribute (no in-village) and out-of-village opacity is 0
        // 4. Show otherwise
        const hideTransformer = 
            (inVillageOpacity === 0 && !hasOutOfVillage) || 
            (inVillageOpacity === 0 && hasOutOfVillage && outOfVillageOpacity === 0) ||
            (!hasInVillage && hasOutOfVillage && outOfVillageOpacity === 0);
        
        if (hideTransformer) {
            return; // Skip this transformer
        }
        
        // Only display transformers with appropriate criteria
        if (transformer.device === "Transformer" && 
            (transformer.status === "Operational" || 
             (transformer.status === "Removed" && showRemovedTransformers) ||
             (transformer.status === "Demolished" && showDemolishedTransformers))) {
            
            // Only check exclusion zones for operational and removed transformers
            // Don't apply the exclusion zone rule to demolished transformers
            if (transformer.status !== "Demolished" && document.getElementById('exclusion-toggle').checked) {
                const point = L.latLng(transformer.lat, transformer.lng);
                if (isPointInExclusionZone(point)) {
                    console.log(`Skipping fallback transformer in exclusion zone: ${transformer.name}`);
                    return;
                }
            }
            
            // Determine bolt color based on status and in-village/out-of-village status
            let boltColor;
            
            if (transformer.status === "Operational") {
                // Special case: If in-village opacity is 0 but out-of-village opacity is not 0,
                // then show as out-of-village regardless of in-village status
                if (inVillageOpacity === 0 && hasOutOfVillage && outOfVillageOpacity > 0) {
                    boltColor = "#FF8C00"; // Orange for out-of-village
                } else {
                    // Otherwise, if both are present, prioritize in-village
                    boltColor = (hasOutOfVillage && !hasInVillage) ? "#FF8C00" : "#FFD700"; // Orange if ONLY out-of-village, yellow otherwise
                }
            } else if (transformer.status === "Removed") {
                // Gray for removed transformers
                boltColor = "#888888";
            } else if (transformer.status === "Demolished") {
                // Red for demolished transformers
                boltColor = "#FF0000";
            }
            
            // Special styling for estimated transformers
            let estimatedClass = "";
            if (transformer.type === "Estimated") {
                estimatedClass = "estimated-transformer";
            }
            
            // Create a custom transformer icon using a pole (custom div) + lightning bolt (Font Awesome)
            const transformerIcon = L.divIcon({
                className: `transformer-icon ${estimatedClass}`,
                html: `<div><span class="fa-bar"></span><i class="fa-solid fa-bolt ${estimatedClass}" style="color: ${boltColor};"></i></div>`,
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
                            <td>${transformer["in-village"]}</td>
                        </tr>
                        <tr>
                            <td>Type:</td>
                            <td>${transformer.type}</td>
                        </tr>
                        <tr>
                            <td>Device:</td>
                            <td>${transformer.device}</td>
                        </tr>
                        ${hasOutOfVillage ? `<tr><td>Serves:</td><td>${transformer["out-of-village"]}</td></tr>` : ''}
                    </table>
                </div>
            `).addTo(iconsLayer);
        }
    });
}

// Add event listeners for all controls
document.addEventListener('DOMContentLoaded', function() {
    // Set initial checkbox states based on saved settings
    document.getElementById('removed-transformers-toggle').checked = savedSettings.toggles.removedTransformers;
    document.getElementById('demolished-transformers-toggle').checked = savedSettings.toggles.demolishedTransformers;
    document.getElementById('estimated-transformers-toggle').checked = savedSettings.toggles.estimatedTransformers; // NEW: Set estimated transformer toggle
    
    // Add event listeners for the transformer toggles
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
    
    // NEW: Add event listener for estimated transformers toggle
    document.getElementById('estimated-transformers-toggle').addEventListener('change', function() {
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
        const estimatedToggle = document.getElementById('estimated-transformers-toggle'); // NEW: Get estimated toggle
        
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
        estimatedToggle.disabled = !isEnabled; // NEW: Disable estimated toggle when icons are off
        
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
    
    // Add event listeners for group opacity sliders to update transformers
    document.getElementById('njenga-opacity-slider').addEventListener('change', function() {
        // Reinitialize transformers when group opacity changes
        initializeTransformers();
        saveSettings();
    });
    
    document.getElementById('reuben-opacity-slider').addEventListener('change', function() {
        // Reinitialize transformers when group opacity changes
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
        
        // Get settlement name directly from polygon properties
        let settlementName;
        if (feature.properties && feature.properties.id) {
            settlementName = feature.properties.id;
        } else {
            // Fallback to finding the closest point
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
                settlementName = extractDescription(closestPoint.properties.description);
            } else {
                return; // Skip if we can't identify the settlement
            }
        }
        
        // Don't place transformers in exclusion zones
        const center = L.latLng(centroidLat, centroidLng);
        if (isPointInExclusionZone(center)) {
            return;
        }
        
        centers[settlementName] = {
            lat: centroidLat,
            lng: centroidLng
        };
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

// Helper function to get transformer locations
function getTransformerLocations() {
    const transformerLocations = [];
    
    // Create a temporary div to hold transformer markers
    const tempDiv = document.createElement('div');
    document.body.appendChild(tempDiv);
    
    // Get transformer locations from the DOM
    const transformerMarkers = document.querySelectorAll('.transformer-icon');
    transformerMarkers.forEach(markerIcon => {
        // Get the parent marker element (which has the latlng)
        const markerParent = markerIcon.closest('.leaflet-marker-icon');
        if (markerParent) {
            // Extract coordinates from the transform style (e.g., "translate3d(123px, 456px, 0px)")
            const transformStyle = markerParent.style.transform;
            const matches = transformStyle.match(/translate3d\((-?\d+(?:\.\d+)?)px, (-?\d+(?:\.\d+)?)px/i);
            
            if (matches && matches.length >= 3) {
                const x = parseFloat(matches[1]);
                const y = parseFloat(matches[2]);
                const latlng = map.containerPointToLatLng([x, y]);
                
                transformerLocations.push(latlng);
            }
        }
    });
    
    // Clean up
    document.body.removeChild(tempDiv);
    
    // If no transformers found via DOM, use a fallback method from the transformer data
    if (transformerLocations.length === 0) {
        // Try to fetch from JSON directly
        try {
            fetch('data/transformers.json')
                .then(response => response.json())
                .then(data => {
                    data.transformers.forEach(transformer => {
                        if (transformer.device === "Transformer" && 
                            transformer.status === "Operational") {
                            transformerLocations.push(L.latLng(transformer.lat, transformer.lng));
                        }
                    });
                });
        } catch (e) {
            console.error('Error loading transformer locations:', e);
        }
    }
    
    return transformerLocations;
}

// Function to calculate bias for a point based on proximity to transformers
function calculateTransformerBias(point, transformerLocations, maxDistance = 0.005) {
    if (!transformerLocations || transformerLocations.length === 0) {
        return 0; // No transformers, no bias
    }
    
    // Find the closest transformer
    let minDistance = Infinity;
    for (const transformerLoc of transformerLocations) {
        const distance = point.distanceTo(transformerLoc);
        minDistance = Math.min(minDistance, distance);
    }
    
    // Convert distance to kilometers for easier calculation
    minDistance = minDistance / 1000;
    
    // If the point is very close to a transformer, give it a high bias
    if (minDistance < maxDistance) {
        // Exponential decay: the closer to the transformer, the higher the bias
        // Value ranges from 0 (far away) to 1 (at the transformer)
        return Math.exp(-minDistance / (maxDistance / 3));
    }
    
    return 0; // No bias for points beyond maxDistance
}

// Function to update density dots
function initializeDensityDots() {
    if (!geoJSONData) return;
    
    // Check if clustering around transformers is enabled
    const clusterAroundTransformers = document.getElementById('cluster-dots-toggle').checked;
    
    // Get all transformer locations if clustering is enabled
    let allTransformerLocations = [];
    if (clusterAroundTransformers) {
        allTransformerLocations = getTransformerLocations();
        console.log(`Found ${allTransformerLocations.length} total transformer locations for clustering`);
    }
    
    // Define the clustering strength factor (0 = no clustering, 1 = maximum clustering)
    const clusteringStrength = 0.7;
    
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
        
        // Get area name directly from polygon's properties
        let areaName = `Area ${index + 1}`; // Default fallback name
        
        // Extract the id from the polygon's properties
        if (feature.properties && feature.properties.id) {
            areaName = feature.properties.id;
        } else {
            // Fallback to the old method if id property is not available
            // Find a name for this polygon by looking for a nearby point with description
            
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
        }
        
        // Store polygon by name for later use
        settlementPolygons[areaName] = L.polygon(latlngs);
    });
    
    // Process each polygon to create density dots
    polygonFeatures.forEach((feature, index) => {
        const coordinates = feature.geometry.coordinates[0];
        const latlngs = coordinates.map(coord => [coord[1], coord[0]]);
        
        // Get area name directly from polygon's properties
        let areaName = `Area ${index + 1}`; // Default fallback name
        
        // Extract the id from the polygon's properties
        if (feature.properties && feature.properties.id) {
            areaName = feature.properties.id;
        } else {
            // Fallback to the old method if id property is not available
            // Find a name for this polygon by looking for a nearby point with description
            
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
        }
        
        // Create a polygon object for point-in-polygon testing
        const polygon = L.polygon(latlngs);
        const bounds = polygon.getBounds();
        const dots = [];
        
        // Filter transformer locations to only include those within this settlement
        let settlementTransformers = [];
        if (clusterAroundTransformers && allTransformerLocations.length > 0) {
            // Only include transformers that are inside this settlement's polygon
            settlementTransformers = allTransformerLocations.filter(location => 
                L.GeometryUtil.isPointInPolygon(location, polygon._latlngs[0])
            );
            
            console.log(`Found ${settlementTransformers.length} transformers in settlement ${areaName}`);
        }
        
        // Flag for whether this settlement has transformers for clustering
        const hasTransformersForClustering = settlementTransformers.length > 0;
        
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
        while ((informalCount < informalDots || kplcCount < kplcDots) && attempts < numDots * 30) {
            attempts++;
            
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
            
            // Generate a random point in the polygon's bounds
            let lat, lng;
            
            // Only cluster KPLC dots around transformers, informal dots remain random
            // Exclude Buildings settlement from clustering
            if (provisionType === "KPLC" && areaName !== "Buildings" && clusterAroundTransformers && hasTransformersForClustering && Math.random() < clusteringStrength) {
                // Clustering mode - use biased location selection around a transformer in this settlement
                
                // Randomly select one of the transformers in this settlement
                const randomTransformerIndex = Math.floor(Math.random() * settlementTransformers.length);
                const transformerPoint = settlementTransformers[randomTransformerIndex];
                
                // Calculate a random point near the transformer (within a reasonable radius)
                // Use smaller radius for denser clustering
                const radius = 0.0025; // ~250 meters
                const angle = Math.random() * 2 * Math.PI;
                // Use exponential distribution to cluster more densely closer to transformer
                const distance = Math.pow(Math.random(), 2) * radius;
                
                // Convert to cartesian
                const dx = distance * Math.cos(angle);
                const dy = distance * Math.sin(angle);
                
                // Add the offset to transformer location
                lat = transformerPoint.lat + dy;
                lng = transformerPoint.lng + dx;
                
                // Ensure the point is within bounds
                if (lat < bounds.getSouth() || lat > bounds.getNorth() || 
                    lng < bounds.getWest() || lng > bounds.getEast()) {
                    // Fall back to random point if outside bounds
                    lat = bounds.getSouth() + Math.random() * (bounds.getNorth() - bounds.getSouth());
                    lng = bounds.getWest() + Math.random() * (bounds.getEast() - bounds.getWest());
                }
            } else {
                // Standard mode - completely random point within bounds
                lat = bounds.getSouth() + Math.random() * (bounds.getNorth() - bounds.getSouth());
                lng = bounds.getWest() + Math.random() * (bounds.getEast() - bounds.getWest());
            }
            
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
    
    // Update sub-toggle states
    const removedToggle = document.getElementById('removed-transformers-toggle');
    const demolishedToggle = document.getElementById('demolished-transformers-toggle');
    const estimatedToggle = document.getElementById('estimated-transformers-toggle');
    
    removedToggle.disabled = !this.checked;
    demolishedToggle.disabled = !this.checked;
    estimatedToggle.disabled = !this.checked;
    
    // Update the legend as well
    const oldLegend = document.querySelector('.transformer-legend');
    if (oldLegend) {
        oldLegend.remove();
    }
    if (this.checked) {
        createTransformerLegend().addTo(map);
    }
    
    // Reinitialize transformers
    initializeTransformers();
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
    
    // Update people per dot calculation
    setTimeout(updatePeoplePerDot, 50);
    
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
            
            // Update URL with new settings
            updateUrlParams(settings);
        } catch (e) {
            console.error('Error saving settings to localStorage:', e);
        }
    }, 300);
});

// Apply density changes when slider value changes
document.getElementById('dot-density-slider').addEventListener('change', function() {
    updateDotDensity();
    saveSettings();
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
        
        // Save settings to URL
        setTimeout(saveSettings, 300);
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
        
        // Save settings to URL
        saveSettings();
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
        // Use a more realistic area name that follows the same pattern
        const areaName = i < 3 ? 
            (i === 0 ? "Sisal" : i === 1 ? "Vietnam" : "Milimani") : 
            (i === 3 ? "Gateway" : "Rurie");
        
        const polyline = L.polyline(contourPolygon, {
            color: getSettlementColor(areaName, "Informal"),  // Use one of the colors
            weight: 2,
            opacity: 0.7,
            className: `contour contour-${areaName.replace(/\s+/g, '-').toLowerCase()}`
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
        { name: "Sisal", lat: -1.3097, lng: 36.8718, group: "Mukuru Kwa Njenga", rotation: 15 },
        { name: "Vietnam", lat: -1.3150, lng: 36.8600, group: "Mukuru Kwa Njenga" },
        { name: "Gateway", lat: -1.3050, lng: 36.8650, group: "Mukuru Kwa Reuben", rotation: -10 },
        { name: "Rurie", lat: -1.3080, lng: 36.8700, group: "Mukuru Kwa Reuben" }
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
        { id: 3, name: "Milimani", lat: -1.31732272, lng: 36.88571341, status: "Operational", "in-village": "Mukuru Kwa Njenga", "out-of-village": "", device: "Transformer", type: "Landlord" },
        { id: 4, name: "Removed Transformer", lat: -1.31492633, lng: 36.88173956, status: "Removed", "in-village": "Mukuru Kwa Njenga", "out-of-village": "", device: "Transformer", type: "KPLC" },
        { id: 5, name: "Demolished Transformer", lat: -1.31782149, lng: 36.88352488, status: "Demolished", "in-village": "Mukuru Kwa Njenga", "out-of-village": "", device: "Transformer", type: "KPLC" },
        { id: 6, name: "Out-of-village Transformer", lat: -1.31300000, lng: 36.88000000, status: "Operational", "in-village": "", "out-of-village": "External Area", device: "Transformer", type: "KPLC" },
        { id: 7, name: "Both In & Out Transformer", lat: -1.31400000, lng: 36.88100000, status: "Operational", "in-village": "Mukuru Kwa Njenga", "out-of-village": "Mukuru Kwa Reuben", device: "Transformer", type: "KPLC" },
        { id: "E1", name: "Estimated Transformer", lat: -1.31600000, lng: 36.88200000, status: "Operational", "in-village": "Mukuru Kwa Njenga", "out-of-village": "", device: "Transformer", type: "Estimated" }
    ];
    
    // Add each transformer to the map
    sampleTransformers.forEach(transformer => {
        // Check which types of transformers to show
        const showRemovedTransformers = document.getElementById('removed-transformers-toggle').checked;
        const showDemolishedTransformers = document.getElementById('demolished-transformers-toggle').checked;
        const showEstimatedTransformers = document.getElementById('estimated-transformers-toggle').checked; // NEW: Check estimated toggle
        
        // Check if this is an estimated transformer that should be hidden
        if (transformer.type === "Estimated" && !showEstimatedTransformers) {
            return; // Skip this transformer if it's estimated and toggle is off
        }
        
        // Check if transformer has in-village and out-of-village attributes
        const hasInVillage = transformer["in-village"] && transformer["in-village"].trim() !== "";
        const hasOutOfVillage = transformer["out-of-village"] && transformer["out-of-village"].trim() !== "";
        
        // Check group opacity for in-village
        const inVillageGroup = transformer["in-village"];
        let inVillageOpacity = 1.0; // Default opacity
        
        if (inVillageGroup === "Mukuru Kwa Njenga") {
            inVillageOpacity = parseFloat(document.getElementById('njenga-opacity-slider').value);
        } else if (inVillageGroup === "Mukuru Kwa Reuben") {
            inVillageOpacity = parseFloat(document.getElementById('reuben-opacity-slider').value);
        }
        
        // Check group opacity for out-of-village (if it's one of our tracked groups)
        const outOfVillageGroup = transformer["out-of-village"];
        let outOfVillageOpacity = 1.0; // Default to visible
        
        if (hasOutOfVillage) {
            if (outOfVillageGroup === "Mukuru Kwa Njenga") {
                outOfVillageOpacity = parseFloat(document.getElementById('njenga-opacity-slider').value);
            } else if (outOfVillageGroup === "Mukuru Kwa Reuben") {
                outOfVillageOpacity = parseFloat(document.getElementById('reuben-opacity-slider').value);
            }
        }
        
        // Determine visibility based on rules:
        // 1. Hide if it has no out-of-village attribute and in-village opacity is 0
        // 2. Hide if both in-village and out-of-village opacities are 0
        // 3. Hide if it has ONLY out-of-village attribute (no in-village) and out-of-village opacity is 0
        // 4. Show otherwise
        const hideTransformer = 
            (inVillageOpacity === 0 && !hasOutOfVillage) || 
            (inVillageOpacity === 0 && hasOutOfVillage && outOfVillageOpacity === 0) ||
            (!hasInVillage && hasOutOfVillage && outOfVillageOpacity === 0);
        
        if (hideTransformer) {
            return; // Skip this transformer
        }
        
        // Only display transformers with appropriate criteria
        if (transformer.device === "Transformer" && 
            (transformer.status === "Operational" || 
             (transformer.status === "Removed" && showRemovedTransformers) ||
             (transformer.status === "Demolished" && showDemolishedTransformers))) {
            
            // Only check exclusion zones for operational and removed transformers
            // Don't apply the exclusion zone rule to demolished transformers
            if (transformer.status !== "Demolished" && document.getElementById('exclusion-toggle').checked) {
                const point = L.latLng(transformer.lat, transformer.lng);
                if (isPointInExclusionZone(point)) {
                    console.log(`Skipping fallback transformer in exclusion zone: ${transformer.name}`);
                    return;
                }
            }
            
            // Determine bolt color based on status and in-village/out-of-village status
            let boltColor;
            
            if (transformer.status === "Operational") {
                // Special case: If in-village opacity is 0 but out-of-village opacity is not 0,
                // then show as out-of-village regardless of in-village status
                if (inVillageOpacity === 0 && hasOutOfVillage && outOfVillageOpacity > 0) {
                    boltColor = "#FF8C00"; // Orange for out-of-village
                } else {
                    // Otherwise, if both are present, prioritize in-village
                    boltColor = (hasOutOfVillage && !hasInVillage) ? "#FF8C00" : "#FFD700"; // Orange if ONLY out-of-village, yellow otherwise
                }
            } else if (transformer.status === "Removed") {
                // Gray for removed transformers
                boltColor = "#888888";
            } else if (transformer.status === "Demolished") {
                // Red for demolished transformers
                boltColor = "#FF0000";
            }
            
            // Special styling for estimated transformers
            let estimatedClass = "";
            if (transformer.type === "Estimated") {
                estimatedClass = "estimated-transformer";
            }
            
            // Create a custom transformer icon using a pole (custom div) + lightning bolt (Font Awesome)
            const transformerIcon = L.divIcon({
                className: `transformer-icon ${estimatedClass}`,
                html: `<div><span class="fa-bar"></span><i class="fa-solid fa-bolt ${estimatedClass}" style="color: ${boltColor};"></i></div>`,
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
                            <td>${transformer["in-village"]}</td>
                        </tr>
                        <tr>
                            <td>Type:</td>
                            <td>${transformer.type}</td>
                        </tr>
                        <tr>
                            <td>Device:</td>
                            <td>${transformer.device}</td>
                        </tr>
                        ${hasOutOfVillage ? `<tr><td>Serves:</td><td>${transformer["out-of-village"]}</td></tr>` : ''}
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
    
    // Define a consistent area name for the fallback
    const areaName = "Sisal"; // Use a real settlement name
    const groupName = "Mukuru Kwa Njenga"; // Consistent with our settlement groups
    
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
            const dotColor = getSettlementColor(areaName, dot.provisionType);
            
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
    // Create an SVG pattern for hatched lines
    const svgContainer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgContainer.setAttribute("style", "position: absolute; width: 0; height: 0;");
    svgContainer.setAttribute("aria-hidden", "true");
    document.body.appendChild(svgContainer);
    
    // Define the pattern for diagonal hatched lines
    const pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
    pattern.setAttribute("id", "exclusion-hatch");
    pattern.setAttribute("patternUnits", "userSpaceOnUse");
    pattern.setAttribute("width", "7");  // Increased spacing between lines
    pattern.setAttribute("height", "7"); // Increased spacing between lines
    pattern.setAttribute("patternTransform", "rotate(34)");
    
    // Create the line element for the pattern
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", "0");
    line.setAttribute("y1", "0");
    line.setAttribute("x2", "0");
    line.setAttribute("y2", "12"); // Match height
    line.setAttribute("stroke", "#555");
    line.setAttribute("stroke-width", "6"); // Thicker lines
    
    // Add the line to the pattern
    pattern.appendChild(line);
    
    // Add the pattern to the SVG container
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.appendChild(pattern);
    svgContainer.appendChild(defs);
    
    fetch('data/exclude.geojson')
        .then(response => response.json())
        .then(data => {
            // Store the raw exclusion GeoJSON data for point-in-polygon tests
            window.exclusionGeoJSON = data;
            
            // Add the exclusion zones to the map
            const exclusionLayer = L.geoJSON(data, {
                style: {
                    color: '#555',       // Grey outline
                    weight: 2,              // Normal border weight
                    opacity: 0.7,           // Normal opacity
                    fillColor: '#888888',   // Grey fill
                    fillOpacity: 0.3,       // More transparent fill
                    dashArray: '5, 5',      // Dashed pattern
                    fillPattern: 'url(#exclusion-hatch)' // Apply hatched pattern
                },
                // Add custom renderer for the pattern
                onEachFeature: function(feature, layer) {
                    // After the layer is added to the map
                    layer.on('add', function() {
                        // Access the SVG path element and apply the pattern
                        if (layer._path) {
                            layer._path.setAttribute('fill', 'url(#exclusion-hatch)');
                        }
                    });
                }
            }).addTo(excludeLayer);
            
            // Add a single "Demolished" label at the center of all exclusion zones
            if (data.features && data.features.length > 0) {
                // Get bounds of the entire exclusion layer
                const bounds = exclusionLayer.getBounds();
                const center = bounds.getCenter();
                
                // Create a label with the same style as settlement labels but in grey
                L.marker(center, {
                    icon: L.divIcon({
                        className: 'label label-demolished',
                        html: `<div style="color: #888888; transform: rotate(-55deg);">Demolished</div>`,
                        iconSize: [120, 20],
                        iconAnchor: [128, 168]
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
            
            // NOTE: "Estimated" entry removed from legend as requested
            
            // Create the rows - add extra row if needed for status entries
            const rows = [];
            for (let i = 0; i < Math.max(locationTypes.length, statusTypes.length); i++) {
                rows.push(document.createElement('tr'));
            }
            
            // Create the location column (always shown)
            locationTypes.forEach((locationType, i) => {
                const locationCell = createLegendCell(locationType);
                rows[i].appendChild(locationCell);
            });
            
            // Create the status column (only if needed)
            if (showStatusColumn) {
                statusTypes.forEach((statusType, i) => {
                    const statusCell = createLegendCell(statusType);
                    rows[i].appendChild(statusCell);
                });
            }
            
            // Add rows to table
            rows.forEach(row => {
                table.appendChild(row);
            });
            
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
        
        // Apply special styling for estimated transformers
        if (item.special === "dotted") {
            bolt.style.border = '1px dotted black';
            bolt.style.padding = '2px';
            bolt.style.borderRadius = '50%';
        }
        
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

// Add the cluster dots toggle event listener
document.getElementById('cluster-dots-toggle').addEventListener('change', function() {
    // Regenerate dots with new clustering setting
    updateDotDensity();
    saveSettings();
});

// Add event listener to capture distribution changes and save to URL
document.getElementById('informal-slider').addEventListener('change', function() {
    // Save settings after a short delay
    setTimeout(saveSettings, 300);
});

// Save settings when changing distribution settlement
document.getElementById('settlement-select').addEventListener('change', function() {
    // Save settings after applying the change
    setTimeout(saveSettings, 300);
});