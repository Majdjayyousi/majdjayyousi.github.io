# Mukuru Interactive Map

An interactive map visualization of the Mukuru area in Nairobi, featuring multiple toggleable layers including contour lines, labels, points of interest, and a density visualization using dots.

## Features

- Interactive map centered on the Mukuru area of Nairobi
- Multiple layers with toggle controls:
  - Contour lines (choropleth)
  - Location labels
  - Points of interest with icons
  - Density visualization using dot patterns
- Light theme design
- Responsive layout

## Technologies Used

- **Leaflet.js**: For the base map and interactive features
- **D3.js**: For advanced visualizations, particularly the density dots
- **HTML/CSS/JS**: Core web technologies for the interface

## Setup and Usage

1. Clone this repository
2. Open `index.html` in a web browser (no server required)
3. Use the layer controls on the right side to toggle different map features

## User Tutorial

### Basic Navigation

- **Pan**: Click and drag the map to move around
- **Zoom**: Use the scroll wheel, pinch gestures, or the +/- buttons in the top left
- **Reset View**: The map will remember your position between sessions; refresh the page with Ctrl+F5 to reset to default

### Background Map Layers

- **Layer Selection**: Use the control in the top right to switch between Standard (street map) and Satellite imagery
- **Opacity Control**: Adjust the "Map Opacity" slider to change the transparency of the base map
  - *Useful for*: Finding the right balance between seeing base geography and overlaid data

### Settlement Areas

- **Contour Lines**: Toggle the "Contour Lines" checkbox to show or hide settlement boundaries
  - *Useful for*: Understanding settlement boundaries and geographic distribution
- **Labels**: Toggle the "Labels" checkbox to show or hide settlement names
  - *Useful for*: Easily identifying different settlements in the Mukuru area
- **Group Opacity**: Use the "Group Opacity" sliders to adjust the visibility of the Mukuru Kwa Njenga and Mukuru Kwa Reuben settlement groups
  - *Useful for*: Focusing on specific areas by fading out others, or creating a layered view

### Electricity Distribution Visualization

- **Density Dots**: Toggle the "Density Dots" checkbox to show or hide the electricity connection dots
  - *Useful for*: Visualizing the distribution and density of electricity connections
- **Dot Size**: Adjust the "Dot Size" slider to change the size of the density dots
  - *Useful for*: Fine-tuning the visualization based on zoom level and display size
- **Dot Density**: Adjust the "Dot Density" slider to change how many dots appear
  - *Useful for*: Controlling the granularity of the visualization from very dense to very sparse
- **Distribution Settings**: Use the dropdown and slider under "Distribution Settings" to:
  - Select a specific settlement
  - Adjust the percentage split between Informal (orange) and KPLC (teal) electricity
  - *Useful for*: Modeling different electrification scenarios or matching field data

### Transformer Visualization

- **Transformers**: Toggle the "Transformers" checkbox to show or hide transformer locations
  - *Useful for*: Understanding electricity infrastructure distribution
- **Transformer Types**: Use the sub-toggles to show/hide:
  - Removed transformers (gray)
  - Demolished transformers (red)
  - Estimated transformers (dotted outline)
  - *Useful for*: Tracking changes in infrastructure over time
- **Transformer Legend**: View the legend at the bottom left showing:
  - Inside settlement transformers (yellow)
  - Outside settlement transformers (orange)
  - *Useful for*: Understanding which areas are served by which infrastructure

### Exclusion Zones

- **Exclusion Zones**: Toggle the "Exclusion Zones" checkbox to show or hide areas that have been demolished or are otherwise excluded
  - *Useful for*: Understanding areas that have undergone significant changes or should be excluded from analysis

### Clustering Around Transformers

- **Cluster Around Transformers**: Toggle this checkbox to make KPLC electricity dots cluster around transformer locations
  - *Useful for*: Creating more realistic visualizations of formal electrical connections, which typically emanate from transformers
  - *Note*: The "Buildings" settlement is excluded from clustering to maintain its random distribution pattern

### Sharing Your View

- **URL Sharing**: The URL in your browser automatically updates with your current settings
  - Simply copy the URL and share it with colleagues
  - When they open the link, they'll see the exact same view with all your settings applied
  - *Useful for*: Collaboration, presentations, and documentation

### Tips for Effective Use

1. **Layer Combinations**: Try different combinations of layers for different analytical purposes:
   - Contours + Transformers: For infrastructure planning
   - Density Dots + Group Opacity: For comparing electrification between settlements
   - Exclusion Zones + Transformers: For redevelopment planning

2. **Performance Optimization**: For slower devices, reduce the number of active layers or decrease dot density

3. **Data Exploration**: Click on transformers to view detailed information about each one

## Project Structure

```
mukuru-map/
├── index.html           # Main HTML file
├── css/                 # CSS styles
│   └── styles.css
├── js/                  # JavaScript files
│   └── main.js
├── data/                # GeoJSON and other data files
│   └── mukuru.geojson
└── assets/              # Icons and other assets
    └── icons/
```

## Future Enhancements

- Add real geographic data for precise boundaries
- Implement more sophisticated density algorithms
- Add search functionality
- Add data filtering options
- Improve mobile experience

## License

This project is available as open source under the terms of the MIT License.

## Credits

Created as a proof of concept for visualizing geographic data with a focus on density representation. 