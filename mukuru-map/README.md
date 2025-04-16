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