exports.doc_landform = 'Classify Landforms with Standardized Topgraphic Position Indices at 2 scales.' +
    '\n  Landscape Pattern with standardized TPI:' +
    '\n https://griffingroups.com/file/download/78264' +
    '\n' +
    '\n do_landforms(dem, thresh_tpi, kern_fine, kern_coarse, kern4norm):' +
    '\n   @param {ee.Image} a DEM' +
    '\n   @param {ee.Number} thresh_tpi TPI threshold for landform classification.' +
    '\n   @param {ee.Number} kern_fine Radius of circle kernal for the fine-scaled TPI calc.' +
    '\n   @param {ee.Number} kern_coarse Radius of circle kernal for the coarse-scaled TPI calc.' +
    '\n   @param {ee.Number} kern4norm Radius of square kernal for calc-ing the local mean and stdv for TPI standardization.' +
    '\n   @return {ee.Image} A 3 band image stack: tpi_coarse_stand, tpi_fine_stand, tpi_landforms.' +
    '\n';

exports.do_landform = function(dem, thresh_slope_flat, thresh_tpi, kern_fine, kern_coarse, kern_4norm){
  /**** TPI CALCS & LANDFORM CLASSIFICATION ****/
  //var thresh_slope_flat = 3;
  // Landscape Pattern with standardized TPI:
  // https://griffingroups.com/file/download/78264
  // dem, 127, 1000, 3000, 500
  var prj = dem.projection();
  //TPI -- > get soil drainage class
  // Theobald et al 2015
  //http://journals.plos.org/plosone/article/file?id=10.1371/journal.pone.0143619&type=printable
  // tpi = Ecenter - Emean
  // TPI standardized
  // reduces the influence of the surface roughness on the detection of slope classes at the local scale
  // Adjust kernel size:
  // Weiss : http://www.jennessent.com/downloads/tpi-poster-tnc_18x22.pdf
  // eg; when zoomed in close, 300 m radius will involve calcs with many more pixels than if zoomed out.

  //var thresh_tpi = 127;
  // Setup kernels
  var kernel_tpi_small = ee.Kernel.circle({radius: kern_fine, units: 'meters', normalize: false}); //pxlSize*7
  var kernel_tpi_large = ee.Kernel.circle({radius: kern_coarse, units: 'meters', normalize: false}); //pxlSize*67
  var kernel_s = ee.Kernel.square({radius: kern_4norm, units: 'meters', normalize: false});          // kernel used for TPI standardization (getting a local mean and stdv)
  // Calc TPI at 2 scales
  var tpi_small = dem.subtract(dem.focal_mean({kernel: kernel_tpi_small, units: "meters"}));
  var tpi_large = dem.subtract(dem.focal_mean({kernel: kernel_tpi_large, units: "meters"}));
  // Calc kernel stdev and means of TPI for standardization
  var tpi_small_stdv = tpi_small.reduceNeighborhood({reducer: ee.Reducer.stdDev(), kernel: kernel_s});
  var tpi_small_mean = tpi_small.focal_mean({kernel: kernel_s});
  var tpi_large_stdv = tpi_large.reduceNeighborhood({reducer: ee.Reducer.stdDev(), kernel: kernel_s});
  var tpi_large_mean = tpi_large.focal_mean({kernel: kernel_s});
  
  // Standardize TPI
  var tpi_small_s = (tpi_small.subtract(tpi_small_mean))
                          .divide(tpi_small_stdv)
                          .multiply(100).add(0.5).int8();
  var tpi_large_s = (tpi_large.subtract(tpi_large_mean))
                          .divide(tpi_large_stdv)
                          .multiply(100).add(0.5).int8();
  
  // Get Landforms from TPI
  var tpi_landforms = ee.Image(0);
  // Order matters
  tpi_landforms = tpi_landforms//.updateMask(water_max_mask)
  .where(tpi_small_s.lte(-thresh_tpi).and(tpi_large_s.lte(thresh_tpi)),1)     //(blue) drainages: local lowland, canyons, deeply incised streams
    .where(tpi_small_s.gt(-thresh_tpi).and(tpi_small_s.lte(thresh_tpi)).and(tpi_large_s.gte(-thresh_tpi)),7)  //upper slopes, mesas
    .where(tpi_small_s.gt(-thresh_tpi).and(tpi_small_s.lte(thresh_tpi)).and(tpi_large_s.lte(thresh_tpi)),4)   //(light green) U-shape valleys
    .where(tpi_small_s.lte(-thresh_tpi).and(tpi_large_s.gt(-thresh_tpi)).and(tpi_large_s.lt(thresh_tpi)),2)   //midslope drainages, shallow valleys
    .where(tpi_small_s.gte(thresh_tpi).and(tpi_large_s.gt(-thresh_tpi)).and(tpi_large_s.lt(thresh_tpi)),9)    //midslope ridges, small hills in plains
    .where(tpi_small_s.lte(-thresh_tpi).and(tpi_large_s.gte(thresh_tpi)),3)     //drainages: upland, headwaters
    //.where(tpi_small_s.lte(-thresh_tpi).and(tpi_large_s.lte(thresh_tpi)),1)     //(blue) drainages: local lowland, canyons, deeply incised streams
    .where(tpi_small_s.gte(thresh_tpi).and(tpi_large_s.gte(thresh_tpi)),10)     //(dark red) mtn tops, ridges //.and(ee.Terrain.slope(dem).gte(0))
    .where(tpi_small_s.gte(thresh_tpi).and(tpi_large_s.lte(-thresh_tpi)),8)     //(dark orange) local ridges/hills in valleys
    .where(tpi_small_s.gt(-thresh_tpi).and(tpi_small_s.lte(thresh_tpi)).and(tpi_large_s.gt(-thresh_tpi)).and(tpi_large_s.lt(thresh_tpi)).and(ee.Terrain.slope(dem).lt(thresh_slope_flat)),5)  //(yellow) plains       //.lte(4)),5)                                        
    .where(tpi_small_s.gt(-thresh_tpi).and(tpi_small_s.lte(thresh_tpi)).and(tpi_large_s.gt(-thresh_tpi)).and(tpi_large_s.lt(thresh_tpi)).and(ee.Terrain.slope(dem).gte(thresh_slope_flat)),6)  //(orange) open slopes
                            //.reproject(prj);
  
  // Return a stack
  var tpi_stack = tpi_large_s.addBands(tpi_small_s)
                              .addBands(tpi_landforms.set({
                                                          0:'unclassified',
                                                          1:'local lowland',
                                                          2:'midslope drainages',
                                                          3:'upland',
                                                           4:'U-shaped valleys',
                                                           5:'plains',
                                                           6:'open slopes',
                                                           7:'upper slopes',
                                                           8:'local ridges',
                                                           9:'midslope ridges',
                                                           10:'mtn topes & ridges'
                                                            }))
                              .rename('tpi_coarse_stand', 'tpi_fine_stand', 'tpi_landforms');
  return(tpi_stack)
        //.reproject(prj) // To view correctly at native res when zoomed in!!! https://developers.google.com/earth-engine/scale
  ;
};

exports.do_aspect_class = function(dem, kernRadius, minSlope, mapfaces) {
  
  // Calculate the aspect, slope throughout the dem
  var asp = ee.Terrain.aspect(dem);
  var slope = ee.Terrain.slope(dem)
  
  // Create a blank image to use to perform operations
  var blank = ee.Image(0);
  
  //Define boundaries for minumum and maximum of north and south facing data
  var nFacingMin = 315.0
  var nFacingMax = 45.0
  var eFacingMin = 45.001
  var eFacingMax = 134.999
  var sFacingMin = 135.0
  var sFacingMax = 225.0
  var wFacingMin = 225.001
  var wFacingMax = 314.999
  
  // For Aspect Classification
  //var minSlope = 10;
  var maxSlope = 90;
      
  // Where are the north and south facing slopes
  var isNfacing = blank.where(
                            asp.lte(nFacingMax)
                            .or(asp.gte(nFacingMin))
                            .and(slope.gt(minSlope))
                            .and(slope.lt(maxSlope))
                            ,1.0);
 var isEfacing = blank.where(
                          asp.lte(eFacingMax)
                          .and(asp.gte(eFacingMin))
                          .and(slope.gt(minSlope))
                          .and(slope.lt(maxSlope))
                          ,1.0);
  var isSfacing = blank.where(
                          asp.lte(sFacingMax)
                          .and(asp.gte(sFacingMin))
                          .and(slope.gt(minSlope))
                          .and(slope.lt(maxSlope))
                          ,1.0);

  var isWfacing = blank.where(
                          asp.lte(wFacingMax)
                          .and(asp.gte(wFacingMin))
                          .and(slope.gt(minSlope))
                          .and(slope.lt(maxSlope))
                          ,1.0);
  //Map.addLayer(water_max_mask, {}, 'water_max_mask');
  var Nface = slope.updateMask(isNfacing);
  var Sface = slope.updateMask(isSfacing);
  var Eface = slope.updateMask(isEfacing);
  var Wface = slope.updateMask(isWfacing);
  
  var NFmin = Nface.focal_min(kernRadius,'square','meters',1);
  var SFmin = Sface.focal_min(kernRadius,'square','meters',1);
  var EFmin = Eface.focal_min(kernRadius,'square','meters',1);
  var WFmin = Wface.focal_min(kernRadius,'square','meters',1);
  
  var sface_pal = ['#ffffb2','#fed976','#feb24c','#fd8d3c','#fc4e2a','#e31a1c','#b10026'];
  var nface_pal = ['#ffffb2','#c7e9b4','#7fcdbb','#41b6c4','#1d91c0','#225ea8','#0c2c84']; //blues (cold)
  var eface_pal = ['#ffffcc','#d9f0a3','#addd8e','#78c679','#41ab5d','#238443','#005a32'];
  var wface_pal = ['#ffffcc','#fcc5c0','#fa9fb5','#f768a1','#dd3497','#ae017e','#7a0177'];
  
  //var mapfaces=1;
  
  if (mapfaces==1){
    Map.addLayer(Nface, {min: minSlope, max:25, palette : nface_pal }, 'North Face');
    Map.addLayer(Sface, {min: minSlope, max:25, palette : sface_pal }, 'South Face');
    Map.addLayer(Eface, {min: minSlope, max:25, palette : eface_pal }, 'East Face');
    Map.addLayer(Wface, {min: minSlope, max:25, palette : wface_pal }, 'West Face');
  }
  
  // Return a simple slope classification: 1, 100, 200, 300
  var asp_class = blank
               .where(isNfacing.eq(1.0),10)
               .where(isEfacing.eq(1.0),20)
               .where(isSfacing.eq(1.0),30)
               .where(isWfacing.eq(1.0),40)
               .set({
                                            10:'North',
                                            20:'East',
                                            30:'South',
                                            40:'West'
               })
  //slope_class = slope_class.updateMask(slope_class.neq(0))
               
  return asp_class
              //.reproject(dem.projection());
}; 

exports.map_landforms = function(landforms_image, description){
// Define an SLD style of discrete intervals to apply to the image.
var sld_intervals =
'<RasterSymbolizer>' +
 ' <ColorMap  type="intervals" extended="false" >' +
    '<ColorMapEntry color="#000000" quantity="0" label="Flat - unclassed"/>' +
    '<ColorMapEntry color="#5e4fa2" quantity="1" label="Flat - local lowland "/>' +
    '<ColorMapEntry color="#3288bd" quantity="2" label="Flat - midslope drainages"/>' +
    '<ColorMapEntry color="#66c2a5" quantity="3" label="Flat - upland"/>' +
    '<ColorMapEntry color="#abdda4" quantity="4" label="Flat - U-shaped valleys"/>' +
    '<ColorMapEntry color="#5e982a" quantity="5" label="Flat - plains"/>' +
    '<ColorMapEntry color="#fee08b" quantity="6" label="Flat - open slopes"/>' +
    '<ColorMapEntry color="#fdae61" quantity="7" label="Flat - upper slopes"/>' +
    '<ColorMapEntry color="#f46d43" quantity="8" label="Flat - local ridges"/>' +
    '<ColorMapEntry color="#d53e4f" quantity="9" label="Flat - midslope ridges"/>' +
    '<ColorMapEntry color="#9e0142" quantity="10" label="Flat - hill mtn tops ridges"/>' +
    '<ColorMapEntry color="#000000" quantity="100" label="NorthFace - unclassed"/>' +
    '<ColorMapEntry color="#5e4fa2" quantity="101" label="NorthFace - local lowland "/>' +
    '<ColorMapEntry color="#3288bd" quantity="102" label="NorthFace - midslope drainages"/>' +
    '<ColorMapEntry color="#66c2a5" quantity="103" label="NorthFace - upland"/>' +
    '<ColorMapEntry color="#abdda4" quantity="104" label="NorthFace - U-shaped valleys"/>' +
    '<ColorMapEntry color="#e6f598" quantity="105" label="NorthFace - plains"/>' +
    '<ColorMapEntry color="#fee08b" quantity="106" label="NorthFace - open slopes"/>' +
    '<ColorMapEntry color="#fdae61" quantity="107" label="NorthFace - upper slopes"/>' +
    '<ColorMapEntry color="#f46d43" quantity="108" label="NorthFace - local ridges"/>' +
    '<ColorMapEntry color="#d53e4f" quantity="109" label="NorthFace - midslope ridges"/>' +
    '<ColorMapEntry color="#9e0142" quantity="110" label="NorthFace - hill mtn tops ridges"/>' +
    '<ColorMapEntry color="#000000" quantity="200" label="EastFace - unclassed"/>' +
    '<ColorMapEntry color="#5e4fa2" quantity="201" label="EastFace - local lowland "/>' +
    '<ColorMapEntry color="#3288bd" quantity="202" label="EastFace - midslope drainages"/>' +
    '<ColorMapEntry color="#66c2a5" quantity="203" label="EastFace - upland"/>' +
    '<ColorMapEntry color="#abdda4" quantity="204" label="EastFace - U-shaped valleys"/>' +
    '<ColorMapEntry color="#e6f598" quantity="205" label="EastFace - plains"/>' +
    '<ColorMapEntry color="#fee08b" quantity="206" label="EastFace - open slopes"/>' +
    '<ColorMapEntry color="#fdae61" quantity="207" label="EastFace - upper slopes"/>' +
    '<ColorMapEntry color="#f46d43" quantity="208" label="EastFace - local ridges"/>' +
    '<ColorMapEntry color="#d53e4f" quantity="209" label="EastFace - midslope ridges"/>' +
    '<ColorMapEntry color="#9e0142" quantity="210" label="EastFace - hill mtn tops ridges"/>' +
    '<ColorMapEntry color="#000000" quantity="300" label="SouthFace - unclassed"/>' +
    '<ColorMapEntry color="#5e4fa2" quantity="301" label="SouthFace - local lowland "/>' +
    '<ColorMapEntry color="#3288bd" quantity="302" label="SouthFace - midslope drainages"/>' +
    '<ColorMapEntry color="#66c2a5" quantity="303" label="SouthFace - upland"/>' +
    '<ColorMapEntry color="#abdda4" quantity="304" label="SouthFace - U-shaped valleys"/>' +
    '<ColorMapEntry color="#e6f598" quantity="305" label="SouthFace - plains"/>' +
    '<ColorMapEntry color="#fee08b" quantity="306" label="SouthFace - open slopes"/>' +
    '<ColorMapEntry color="#fdae61" quantity="307" label="SouthFace - upper slopes"/>' +
    '<ColorMapEntry color="#f46d43" quantity="308" label="SouthFace - local ridges"/>' +
    '<ColorMapEntry color="#d53e4f" quantity="309" label="SouthFace - midslope ridges"/>' +
    '<ColorMapEntry color="#9e0142" quantity="310" label="SouthFace - hill mtn tops ridges"/>' +
    '<ColorMapEntry color="#000000" quantity="400" label="WestFace - unclassed"/>' +
    '<ColorMapEntry color="#5e4fa2" quantity="401" label="WestFace - local lowland "/>' +
    '<ColorMapEntry color="#3288bd" quantity="402" label="WestFace - midslope drainages"/>' +
    '<ColorMapEntry color="#66c2a5" quantity="403" label="WestFace - upland"/>' +
    '<ColorMapEntry color="#abdda4" quantity="404" label="WestFace - U-shaped valleys"/>' +
    '<ColorMapEntry color="#e6f598" quantity="405" label="WestFace - plains"/>' +
    '<ColorMapEntry color="#fee08b" quantity="406" label="WestFace - open slopes"/>' +
    '<ColorMapEntry color="#fdae61" quantity="407" label="WestFace - upper slopes"/>' +
    '<ColorMapEntry color="#f46d43" quantity="408" label="WestFace - local ridges"/>' +
    '<ColorMapEntry color="#d53e4f" quantity="409" label="WestFace - midslope ridges"/>' +
    '<ColorMapEntry color="#9e0142" quantity="410" label="WestFace - hill mtn tops ridges"/>' +
  '</ColorMap>' +
'</RasterSymbolizer>';
  Map.addLayer(landforms_image, {}, 'Landforms with value for querying', false);
  Map.addLayer(landforms_image.sldStyle(sld_intervals), {}, description, true);
}

exports.do_tsri = function(dem){
  //TSRI = 1 - cos ((pi/180)(ee.Terrain.aspect(dem) - 30))/2
  // INCOMPLETE -- figure out how to subtract from 1
  return ee.Terrain.aspect(dem).subtract(30).multiply(Math.PI).divide(180).cos().divide(2);
}

exports.get_epsg102001 = function(){
  var epsg102001 = 'PROJCS["Canada_Albers_Equal_Area_Conic", ' +
    'GEOGCS["NAD83", ' +
      'DATUM["North_American_Datum_1983", ' +
        'SPHEROID["GRS 1980", 6378137.0, 298.2572221010042, AUTHORITY["EPSG","7019"]], ' +
        'TOWGS84[0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0], ' +
        'AUTHORITY["EPSG","6269"]], ' +
      'PRIMEM["Greenwich", 0.0], ' +
      'UNIT["degree", 0.017453292519943295], ' +
      'AXIS["Longitude", EAST], ' +
      'AXIS["Latitude", NORTH], ' +
      'AUTHORITY["EPSG","4269"]], ' +
    'PROJECTION["Albers_Conic_Equal_Area"], ' +
    'PARAMETER["central_meridian", -96.0], ' +
    'PARAMETER["latitude_of_origin", 40.0], ' +
    'PARAMETER["standard_parallel_1", 50.0], ' +
    'PARAMETER["false_easting", 0.0], ' +
    'PARAMETER["false_northing", 0.0], ' +
    'PARAMETER["standard_parallel_2", 70.0], ' +
    'UNIT["m", 1.0], ' +
    'AXIS["x", EAST], ' +
    'AXIS["y", NORTH]]';
  return(epsg102001)
}

exports.transform_epsg102001 = function(){
  return( [30,0,0,0,-30,20] )
}
/**** FUNCTIONS ****/
// https://code.earthengine.google.com/5062cccb51dc885567765e6920cd52e0

// Get radians
function radians(img) {
  return img.toFloat().multiply(Math.PI).divide(180);
}

// DEM Hillshade function - Compute hillshade for the given illumination az, el.
function hillshade(az, ze, slope, aspect) {
  var azimuth = radians(ee.Image(az));
  var zenith = radians(ee.Image(ze));
  return azimuth.subtract(aspect).cos().multiply(slope.sin()).multiply(zenith.sin())
      .add(zenith.cos().multiply(slope.cos()));
}
function hillshadeit(image, elevation, weight, height_multiplier, azimuth, zenith) {
  var hsv  = image.unitScale(0, 255).rgbtohsv();
  var terrain = ee.call('Terrain', elevation.multiply(height_multiplier));
  var slope = radians(terrain.select(['slope']));
  var aspect = radians(terrain.select(['aspect']));
  var hs = hillshade(azimuth, zenith, slope, aspect);
  var intensity = hs.multiply(weight).multiply(hsv.select('value'));
  var huesat = hsv.select('hue', 'saturation');
  return ee.Image.cat(huesat, intensity).hsvtorgb();
}
function renderDem() {
  var aoi = ee.FeatureCollection('ft:1778IyIZLZKSKVgko9X3aIV94E7jcm28uniyD6ycp')
    .filter(ee.Filter.eq('HYBAS_ID', 5030073410));
  var style_dem = '\
  <RasterSymbolizer>\
    <ColorMap  type="intervals" extended="false" >\
      <ColorMapEntry color="#cef2ff" quantity="-200" label="-200m"/>\
      <ColorMapEntry color="#9cd1a4" quantity="0" label="0m"/>\
      <ColorMapEntry color="#7fc089" quantity="50" label="50m" />\
      <ColorMapEntry color="#9cc78d" quantity="100" label="100m" />\
      <ColorMapEntry color="#b8cd95" quantity="250" label="250m" />\
      <ColorMapEntry color="#d0d8aa" quantity="500" label="500m" />\
      <ColorMapEntry color="#e1e5b4" quantity="750" label="750m" />\
      <ColorMapEntry color="#f1ecbf" quantity="1000" label="1000m" />\
      <ColorMapEntry color="#e2d7a2" quantity="1250" label="1250m" />\
      <ColorMapEntry color="#d1ba80" quantity="1500" label="1500m" />\
      <ColorMapEntry color="#d1ba80" quantity="10000" label="10000m" />\
    </ColorMap>\
  </RasterSymbolizer>';
  var azimuth = 90;
  var zenith = 15;
  //var dem = ee.Image('USGS/SRTMGL1_003');
  
  // TODO: how to include kernels?
  var gaussianKernel = ee.Kernel.gaussian(2, 1, 'pixels', true, 2);
  dem = dem.convolve(gaussianKernel);

  //var v = dem.clip(aoi).sldStyle(style_dem);
  var v = dem.sldStyle(style_dem);

  return hillshadeit(v, dem, 1.1, 2.0, azimuth, zenith);
}
function smooth_image(image) {
  image = image
    .focal_max({radius: 10*pxlSize, units: 'meters'})
    .focal_mode({radius: 20*pxlSize, units: 'meters', iterations: 5})
    .focal_min({radius: 10*pxlSize, units: 'meters'});
  return image;
}
