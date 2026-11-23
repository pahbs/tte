/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var cal_2m_tcc = ee.Image("users/paulmontesano/tte_L7/cal_2010_2015/cal_2m_tcc"),
    orig_tcc = ee.ImageCollection("users/minfeng/tcc/tcc_tte_dat"),
    tcc_err = ee.Image("users/minfeng/tcc/tcc_tte_err"),
    soils = ee.FeatureCollection("users/paulmontesano/arc/NCSCD_Circumarctic_WGS84"),
    ecoregions = ee.FeatureCollection("users/paulmontesano/arc/wwf_terr_ecos_taiga-tundra"),
    mcd43a2 = ee.ImageCollection("MODIS/006/MCD43A2"),
    na_hudwest_roi = /* color: #d63000 */ee.Geometry.Polygon(
        [[[-89.15817260742188, 55.34378942751895],
          [-89.15987958186463, 55.34063551183891],
          [-89.15087699890137, 55.33231795527552],
          [-89.14186477661133, 55.332025023134555],
          [-89.12881851196289, 55.34286207020478]]]),
    eu_west_roi = /* color: #98ff00 */ee.Geometry.Polygon(
        [[[66.9114904267883, 65.80533562447889],
          [66.92400024963376, 65.76293923196752],
          [67.10864351821897, 65.76329157564108],
          [67.08227203918455, 65.80643487243297]]]),
    na_brooks_roi = /* color: #0b4a8b */ee.Geometry.Polygon(
        [[[-155.3082275390625, 66.88697184836789],
          [-153.193359375, 66.93436492078078],
          [-153.4625244140625, 67.22105296735408],
          [-155.1104736328125, 67.14863213340215]]]),
    image = ee.Image("WWF/HydroSHEDS/30CONDEM"),
    permafrost = ee.FeatureCollection("users/paulmontesano/arc/permaice_WGS84"),
    water = ee.Image("JRC/GSW1_0/GlobalSurfaceWater"),
    dem2 = ee.Image("CGIAR/SRTM90_V4"),
    dem3 = ee.Image("USGS/GMTED2010"),
    dem4 = ee.Image("USGS/GTOPO30"),
    eu_khatanga_roi = /* color: #d63000 */ee.Geometry.Polygon(
        [[[101.64887320078276, 72.19398622436353],
          [101.3675295244509, 72.00887652494725],
          [101.47387988724154, 71.97009827609722],
          [101.79969774030246, 71.9357094076197],
          [102.40346193328378, 72.03983823095119],
          [102.73706609777184, 72.24613915265282],
          [102.36198287073114, 72.27518167924367],
          [102.14031480322842, 72.27031055160735]]]),
    plots = ee.FeatureCollection("users/paulmontesano/arc/eurasia_forest_structure_plots"),
    QB_val_pts = ee.FeatureCollection("users/paulmontesano/arc/vcf_validation_points_433_with_zone"),
    bio2 = ee.Image("users/kd498/bioclim2_1km"),
    dem5 = ee.Image("JAXA/ALOS/AW3D30_V1_1"),
    cavm = ee.FeatureCollection("users/paulmontesano/arc/CAVM_treeline"),
    test_subset = /* color: #d63000 */ee.Geometry.MultiPolygon(
        [[[[-109.82044206944107, 62.47161379245818],
           [-109.86668864537182, 61.2268515378877],
           [-106.96387369654565, 61.229019272026754],
           [-107.23505956323311, 62.52294284306601]]],
         [[[-105.62255859375, 61.79390039913457],
           [-105.75439453125, 60.46805012087462],
           [-102.568359375, 60.446381859956034],
           [-102.67822265625, 61.825040379926115]]]]),
    LVIS2017 = ee.FeatureCollection("users/paulmontesano/arc/LVIS_FLown_Lines_20170926"),
    test_point = /* color: #d63000 */ee.Geometry.Point([-105.72512626647949, 63.763539486898246]),
    tcc_han = ee.Image("UMD/hansen/global_forest_change_2018_v1_6"),
    dem6 = ee.Image("UMN/PGC/ArcticDEM/V2/5m"),
    tcc_2015 = ee.ImageCollection("users/minfeng/tcc_global_comb"),
    glcf_water = ee.ImageCollection("GLCF/GLS_WATER"),
    test_export = /* color: #d63000 */ee.Geometry.Polygon(
        [[[57.951364000050035, 69.89196482853256],
          [57.161740061473665, 65.02843449960805],
          [82.95026469628021, 64.07378502204885],
          [105.77993620714255, 71.37991012263441],
          [98.06508849438467, 73.54139230097005],
          [68.76693088211073, 70.16195429818514]]]),
    test_export_small = /* color: #98ff00 */ee.Geometry.Polygon(
        [[[66.12209802104894, 68.297828205156],
          [63.92483239604894, 67.13154543086341],
          [67.26467614604894, 66.89126909895738],
          [68.14358239604894, 67.57151158457408]]]),
    permprob = ee.Image("users/paulmontesano/UiO_PEX_PERPROB_30_20171201_2000_2016"),
    Tavg_30s_july = ee.Image("projects/mangrovescience/WorldClim_v2/wc20_30s_tavg_07"),
    hybas_lake_si_lev03_v1c = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_si_lev03_v1c"),
    hybas_lake_si_lev02_v1c = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_si_lev02_v1c"),
    hybas_lake_eu_lev02_v1c = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_eu_lev02_v1c"),
    hybas_lake_ar_lev02_v1c = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_ar_lev02_v1c"),
    hybas_lake_na_lev02_v1c = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_na_lev02_v1c"),
    hybas_lake_ar_lev03_v1c = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_ar_lev03_v1c"),
    hybas_lake_eu_lev03 = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_eu_lev03_v1c"),
    hybas_lake_na_lev03 = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_na_lev03_v1c"),
    lvis_30m = ee.Image("users/paulmontesano/lvis2_30m_above2017_retge_1p37m"),
    lvis_cnt = ee.Image("users/paulmontesano/lvis2_30m_above2017_lvis_pt_cnt");
/***** End of imports. If edited, may not auto-convert in the playground. *****/
//Map.setCenter(100.7, 65.6	, 14);
//
// The bioclimatic extent and pattern of the taiga-tundra ecotone
// https://iopscience.iop.org/article/10.1088/1748-9326/abb2c7
//
// Workflow to reproduce the TTE map
//
var fs = require('users/paulmontesano/montesano:mod_forest_structure.js');
var lf = require('users/paulmontesano/montesano:mod_landform.js');

var tte_zones_viz = {min: 1, max: 4, palette: ['#fc8d59','#ffffbf','#91cf60','#cccccc']}; //['#d95f02','#1b9e77','#7570b3','#cccccc']};//brown, green ,purple,gray=#cccccc , or magenta=#e7298a
var tcc_pal = ['#8c510a','#d9f0a3','#addd8e','#78c679','#41ab5d','#238443','#005a32'];
var tcc_viz = {min: 0, max: 80, palette: tcc_pal};
var tcc_err_pal = ['#d7191c','#fdae61','#ffffbf','#abd9e9','#2c7bb6'].reverse();
var tcc_relerr_viz = {min: 0.1, max: 200, palette: tcc_err_pal};
var tcc_err_viz = {min: 17, max: 20, palette: tcc_err_pal};
var pal_abrupt = ['#d7191c','#fdae61','#ffffbf','#abdda4','#2b83ba'].reverse();
var abruptness_viz = {min: -1, max: 1, palette: pal_abrupt};
var pal_land = ['#d73027','#f46d43','#fdae61','#fee08b','#ffffbf','#d9ef8b','#a6d96a','#66bd63','#1a9850']
var pal_tpi = ['#b2182b','#ef8a62','#fddbc7','#f7f7f7','#d1e5f0','#67a9cf','#2166ac'].reverse();
var pal_pearson = ['#d7191c','#fdae61','#ffffbf','#abdda4','#2b83ba'];
/////////
// TCC Version
// [1] consistent mask with tte_domain (water mask from Feng 2015 (Cal2m TCC masked), for consistency when comparing validations with lidar in NA)
// [2] remove loss from years before 2010
//var num_month = 7 // NEW, using Hansen 2000 for EU and NA 
//var num_month = 6 // NEW, using Cal2m masked for EU and NA
var num_month = 2 // NEW, using Cal2m masked for NA and Hansen for EU 
//var num_month = 9 // VALIDATE with LVIS --> run TTE map with LVIS input
///////////////////////////////////////////////
// Setup TCC: reprojections for coarsening
///////////////////////////////////////////////
var TCC_res = 30; // coarsening needed for TCC data in Siberia where ther are SLC gaps
var maxTCC = 30;
///////////////////////////////////////////////
// ******
// ATTENTION: force projection display below using: .reproject(cal_2m_tcc.select('b1').projection(), null, TCC_res)
// ******
//---> Calibrated TCC (Montesano et al)
var cal_2m_tcc = cal_2m_tcc.select('b1')                //.reproject(cal_2m_tcc.select('b1').projection(), null, TCC_res);
var proj_cal_2m = cal_2m_tcc.projection();

// Feng et al 2015 water mask
var water_mask_feng2015 = cal_2m_tcc.updateMask(cal_2m_tcc.eq(200)); //or, cal_2m_tcc = 200?

//---> GLCF TCC (Sexton et al).. (turn orig tcc into an image from an image collection)
var tcc_2015 = ee.Image(tcc_2015.min()).reproject(proj_cal_2m, null, TCC_res);
var orig_tcc = ee.Image(orig_tcc.min()).reproject(proj_cal_2m, null, TCC_res); // Get projection information from cal tcc (which is in meters), apply to orig tcc (in GCS)

// Set TCC Mask: pixel values
var cal_2m_tcc_masked = cal_2m_tcc.updateMask(cal_2m_tcc.lte(100).and(cal_2m_tcc.gte(0)));                                                                // CHANGE TO updateMask !!!!
var orig_tcc_masked = orig_tcc.updateMask(orig_tcc.lte(100).and(orig_tcc.gte(0)));                                                                        // CHANGE TO updateMask !!!!
var tcc_2015_masked = tcc_2015.updateMask(tcc_2015.lte(100).and(tcc_2015.gte(0)));

//---> Hansen TCC (Hansen et al)
var tcc_han_2000 = tcc_han.select(['treecover2000'])
// 2001-2009 Mask Layer
var lossyr_han = tcc_han.select(['lossyear']);
var lossyr_han_before2010 = lossyr_han.gt(0).and(lossyr_han.lt(10));
// Get TCC 2010 from TCC 2000 - After Masking (2001-2009)
var tcc_han_2010 = tcc_han_2000.not().updateMask(lossyr_han_before2010).unmask(tcc_han_2000)
                          .rename('b1')
                          .reproject(proj_cal_2m, null, TCC_res)
                          //.updateMask(cal_2m_tcc_masked); // use same mask as Cal 2m

//////////////////////////////////////////////
// Get DEM
var dem = dem5.select("MED").reproject(proj_cal_2m, null, TCC_res*3);
var dem = dem6.select("elevation").reproject(proj_cal_2m, null, 90);
// -- use TDX 90m when ready
//////////////////////////////////////////////
// Get PERMAFROST PROBABILITY from Obu et al 2018 : https://doi.pangaea.de/10.1594/PANGAEA.888600
//permprob = permprob.reproject(proj_cal_2m, null, 90)
//Map.addLayer(permprob, {min: 0, max: 0.999, palette: tcc_err_pal.reverse()}, 'Permafrost Prob', true)
//////////////////////////////////////////////
// TTE BIOCLIMATIC ENVELOPE: DOMAIN MASK
//
/*..represents a LIMITING environmental factor
[A] COARSE SCALE CONTROLS of TTE DOMAIN
constrain cold and warm edges with [1] and [2]
[1] Get Bioclimatic input to establish domain: MEAN TEMP OF WARMEST QUARTER
http://www.worldclim.org/bioclim --> 
    bio_05 = Max temp of warmest month
    bio_10 = Mean Temperature of Warmest Quarter
    bio_18 = Precipitation of Warmest Quarter
Note: where mean July isotherm = 10C is generally understood as treeline*/
var precip_envelope = bio2.select('bio_18')//.reproject(proj_cal_2m.atScale(500));
var clim_envelope = bio2.select('bio_10')//.reproject(proj_cal_2m.atScale(500)); //Tavg_30s_july

var clim_min = 7
var clim_max = 14
var precip_min = 0
var precip_max = 125
//precip_envelope = precip_envelope.mask(precip_envelope.gt(precip_min).and(precip_envelope.lt(precip_max))); 
clim_envelope = clim_envelope.mask(clim_envelope.gt(clim_min).and(clim_envelope.lt(clim_max))); // area within this interval is the CLIMATIC ENVELOPE
var clim_envelope_mask = clim_envelope.where(clim_envelope.neq(0),1)

// the 'line' where MEAN WARMEST QRT = 10°C  
var clim_envelope_10 = clim_envelope.mask(clim_envelope.gte(9.95).and(clim_envelope.lte(10.05)));
// WARM SIDE of this ISOTHERM
var clim_envelope_warm = clim_envelope.mask(clim_envelope.gt(10.05).and(clim_envelope.lt(clim_max)));
// COLD SIDE of this ISOTHERM
var clim_envelope_cold = clim_envelope.mask(clim_envelope.gt(clim_min).and(clim_envelope.lt(9.95)));


// [2] WWF TTE ECOREGION vectors
// biomes value=6 (taiga) and value=11 (tundra); make sure to exclude mountain tundra in mid-lat value=10
var eco_NA = ee.FeatureCollection(ecoregions.filter(ee.Filter.stringContains('REALM', 'NA')));
var eco_EU = ee.FeatureCollection(ecoregions.filter(ee.Filter.stringContains('REALM', 'PA')));
eco_EU = eco_EU.reduceToImage({properties: ['BIOME'],reducer: ee.Reducer.first() });
eco_NA = eco_NA.reduceToImage({properties: ['BIOME'],reducer: ee.Reducer.first() });

/*var vector_mask = ecoregions                                    
var vector_mask_biome = vector_mask.reduceToImage({properties: ['BIOME'],reducer: ee.Reducer.first() });
var vector_mask_econum = vector_mask.reduceToImage({properties: ['ECO_NUM'],reducer: ee.Reducer.first() });
var vector_mask_ecoid = vector_mask.reduceToImage({properties: ['ECO_ID'],reducer: ee.Reducer.first() });
var vector_mask_larch = vector_mask.reduceToImage({properties: ['larix_eu'],reducer: ee.Reducer.max() });*/

// TTE ECOREGION EXTENT
var ecoregion_extent = ee.ImageCollection([
                          eco_NA.updateMask(eco_NA.neq(10)),
                          eco_EU.updateMask(eco_EU.neq(10))
/*                          // eco_EU.updateMask(vector_mask_larch.eq(1)),
                          // eco_EU.updateMask(vector_mask_ecoid.eq(81114)),
                          // eco_EU.updateMask(vector_mask_econum.eq(10)), 
                          // eco_EU.updateMask(vector_mask_ecoid.eq(80611)),
                          // eco_EU.updateMask(vector_mask_ecoid.eq(81111)),
                          // eco_EU.updateMask(vector_mask_ecoid.eq(81108)),
                          // eco_EU.updateMask(vector_mask_ecoid.eq(80608)),
                          // eco_EU.updateMask(vector_mask_ecoid.eq(81106)),
                          // eco_EU.updateMask(vector_mask_ecoid.eq(80606))*/
                                ]).max()
ecoregion_extent = ecoregion_extent.where(ecoregion_extent.neq(0),1)
/*
// This produces a vector that fills internal polygon holes..no good.     
var resDrive = 5000
var clim_envelope_mask_vector = fs.get_footprint(clim_envelope_mask, resDrive, ee.Geometry.Rectangle([-180, 45, 180, 80], null, false))
var ecoregion_extent_mask_vector = fs.get_footprint(ecoregion_extent, resDrive, ee.Geometry.Rectangle([-180, 45, 180, 80], null, false))
*/
/*
// ECOREGION EXTENT + CLIM ENVELOPE = BIOCLIM ENVELOPE of TTE
// The INTERSECTION of the ECOREGION EXTENT and THE CLIMATIC ENVELOPE is "The BIOCLIMATE ENVELOPE OF THE TTE"
Map.addLayer(clim_envelope_mask, {min:1, max:1, palette:"#f2ff38"}, "Clim Env mask")
Map.addLayer(ecoregion_extent, {min:1, max:1, palette:"#0ea721"}, "Ecoregion Extent")
*/
var bioclim_env_tte = ecoregion_extent.updateMask(clim_envelope_mask)
Map.addLayer(bioclim_env_tte, {min:1, max:1, palette:"#9f4ac2"}, "Bioclimatic Envelope of TTE")

/*
var polar_stereo_wkt = 'PROJCS["unnamed", GEOGCS["unnamed ellipse", DATUM["unknown", SPHEROID["unnamed",6378273,298.279411123064]],'+
                  'PRIMEM["Greenwich",0], UNIT["degree",0.0174532925199433]], PROJECTION["Polar_Stereographic"],'+
                  'PARAMETER["latitude_of_origin",90], PARAMETER["central_meridian",0], PARAMETER["scale_factor",1],'+
                  'PARAMETER["false_easting",0], PARAMETER["false_northing",0], UNIT["Meter",1]]'
*/

// Compute the intersection: must dissolve first? https://code.earthengine.google.com/d73a4ef6335c12b8981f9a4c757de166

// [B] FINE SCALE CONTROLS of TTE DOMAIN
// [3] Define Water
water = water.reproject(proj_cal_2m, null, TCC_res);
var water_seas = water.select('seasonality');
var water_ocur = water.select('occurrence');
//water_ocur = water_ocur.updateMask(water_ocur.lt(50))
var water_recur = water.select('recurrence');
//var water_mask = water_recur.unmask(0).lt(90);
// Set 'water' to 0 TCC
// Determine 'water'
//      aggressively;  occurrence gte 1 ; helps get ABRUPT edges next to water
//      loosely;  occurrence gte 75
//Map.addLayer(TCC_primary, tcc_viz, "TCC prim before water ", false);
// --- EDIT: water_ocur unmask; this is done to tcc_data later so both TCC_primary and hansen get it  -- > TCC_primary = TCC_primary.unmask(water_ocur.gte(1)).where(water_ocur.gte(1),0)

// NOTE: the use of tcc_err is just a means to initialize the date with the Feng et al 2015 water mask
// [5] Approximate Relative Error of TCC using Cal 2m (Montesano et al 2016) and Error from Sexton et al 2013
var tcc_RelErr = tcc_err.divide(cal_2m_tcc_masked).multiply(100); 

// [6] Do TTE Domain; initialize with TCC RelErr mask
//  This just effectively initialized the pixel-level data with water mask from Feng et al. 2015
var tte_domain = tcc_RelErr.where(tcc_RelErr.gte(0),1);             //important to NOT mask out 0 values for RelErr from Sexton et al., b/c open larch areas that have incomplete estimates will be masked out of abruptness calc
  //tte_domain = tte_domain.mask(---water_ocur-----)                  // Apply water mask to tte_domain here???
  //tte_domain = tte_domain.updateMask(tte_domain.gt(0));             //All together, the RelErr mask provides context for the TCC estimate masks set below
// TTE DOMAIN with COARSE and FINE SCALE CONTROLS (finalize with 'mask_abrupt' below)
//tte_domain = tte_domain.clip(vector_mask);  // ECOREGIONS component of mask

// Clip to ECOREGION EXTENT and BIOCLIMATIC ENVELOPE
//tte_domain = tte_domain.updateMask(clim_envelope).int8()          //.updateMask(water_mask);
//tte_domain = tte_domain.clip(ecoregion_extent_mask_vector)
 //                      .clip(clim_envelope_mask_vector)
tte_domain = tte_domain.updateMask(bioclim_env_tte)                     
                       
// Get Final Circumpolar TCC Estimates
//    Determine which TCC estimates to use: [1] Calibrated 2m TCC used in NA and EU non-larch areas 
//                                          [2] ICRSS2018: Mean of [orig 2m TCC, hansen2000] used in EU larch areas AND those EU non-larch areas associated with the ecoid or econum specified below ()
//                                          [3] AGU2018: cal 2m tcc in NA, hansen2000 in EU 


if(num_month==7){
  // Examine this (v201907): this should have water masking consistent and the tte_domain correct?
  var tcc_data = tte_domain
                    .where(eco_NA.gt(0), tcc_han_2010)
                    .where(eco_EU.gt(0), tcc_han_2010);
}else if(num_month==6){
  // Examine this (v201906): this uses our Cal 2m data for the circumpolar, just to get a comparable validation
  var tcc_data = tte_domain
                    .where(eco_NA.gt(0), cal_2m_tcc_masked) 
                    .where(eco_EU.gt(0), cal_2m_tcc_masked);
}else if(num_month==2){
  // ORIGINAL version (v201902): arrangement of TCC products: NA (Cal 2m, Feng/Montesano), EU (Hansen 2010)
  var tcc_data = tte_domain
                    .where(eco_NA.gt(0), cal_2m_tcc_masked)
                    .where(eco_EU.gt(0), tcc_han_2010);
}else if(num_month==9){
  // VALIDATION version (v201909): use LVIS TCC
  ////////////////////////////////////////
  // LVIS 2017
  // masking: removing pixels where n is less than 12
  lvis_30m = lvis_30m.updateMask(lvis_cnt.gte(12));
  var tcc_data = tte_domain.where(lvis_30m.gte(0), lvis_30m).updateMask(lvis_30m);
  Map.addLayer(tcc_data, tcc_viz, 'INPUT TCC Data', false);
}

// Water Occurrence (frequency)
// Use this to recode TCC to 0, to be able to demarcate TCC adjacent to water
Map.addLayer(water_ocur, {min:1, max:50, palette: ['#f1eef6','#d0d1e6','#a6bddb','#74a9cf','#3690c0','#0570b0','#034e7b']}, 'Water Ocur')
tcc_data = tcc_data.unmask(water_ocur.gte(1)).where(water_ocur.gte(1),0)    //This step CRITICAL for ABRUPT edges next to water
Map.addLayer(tcc_data, tcc_viz, 'TCC  Masked with water', false);
// [2] Compute Abruptness for TCC Domain
// **************************************************
var fs = require('users/paulmontesano/montesano:mod_forest_structure.js');
var tcc_data = fs.get_abruptness(tcc_data);

print("TCC Data", tcc_data)

//    Masked with tte_domain (BUT AFTER ABRUPTNESS CALC?)
tcc_data = tcc_data.updateMask(tte_domain);                                   

// [3] Finalize Abruptness Mask: 2 masking conditions
// This removes vast extents of TCC=0 AND Abruptness=0, which is meaningless - areas where TCC=0 and Abruptness=1 is the "leading edge"
var mask_abrupt = tcc_data.select('tcc').gte(0)                               // condition 1: TCC
                  .and(tcc_data.select('tcc_abruptness').abs().gt(0))         // condition 2: Abruptness  - this creates a 1-pixel buffer around inland water
tcc_data = tcc_data.updateMask(mask_abrupt);
//tte_domain = tte_domain.updateMask(mask_abrupt)

var tcc_data_abruptness = tcc_data.select('tcc_abruptness');
/*
Map.addLayer(tte_domain, {min:0, max:1, palette: ['#6a6a6a']}, 'TTE Domain', false); 
Map.addLayer(clim_envelope_cold, {palette: ['#377eb8']}, 'cold side of clim envelope', false); //updateMask(tte_domain)
Map.addLayer(clim_envelope_warm, {palette: ['#4daf4a']}, 'warm side of clim envelope', false);
Map.addLayer(clim_envelope_10, {palette: ['#e41a1c']}, 'Isotherm: mean 10° of warmest qrt', false);
Map.addLayer(hybas_lake_si_lev02_v1c.merge(hybas_lake_eu_lev02_v1c).merge(hybas_lake_ar_lev02_v1c).merge(hybas_lake_na_lev02_v1c), {}, "hybas_lake_L02", false);
*/
// Check with LVIS
var tcc_lvis = fs.get_abruptness(lvis_30m);
tcc_lvis = tcc_lvis.updateMask(tcc_lvis.select('tcc').gte(0).and(tcc_lvis.select('tcc_abruptness').abs().gt(0)) );
var tcc_lvis_abruptness = tcc_lvis.select('tcc_abruptness');

// [4] TTE Zones: define thresholds of TCC data within TTE Domain; after accounting for RelErr (above)
// **************************************************
var tte_zones = tte_domain//.updateMask(tte_domain.eq(1))
                          //.where(tte_domain.eq(1),0)
                          .where(tcc_data.select('tcc').gt(0).and(tcc_data.select('tcc').lte(5)),1)                   // Zone 1: Sporadic <= 5%    tcc gt(0) could be correct!.. was previously using gte(0)   --> effects TTE Classes --> results in 0, or unclassified.. CHECK AND FIX                                                
                          .where(tcc_data.select('tcc').gt(5).and(tcc_data.select('tcc').lte(maxTCC)),2)              // Zone 2: Open Canopy 6 - 30
                          .where(tcc_data.select('tcc').gt(maxTCC).and(tcc_RelErr.gt(50)),3)                          // Zone 3: Intermediate Canopy > 30% & RelErr > 50%
                          .where(tcc_data.select('tcc').gt(maxTCC).and(tcc_RelErr.lt(50)),4)                          // Zone 4: Intermediate Canopy > 30% & Low RelErr lte 50%
                          ;                       
tte_zones = tte_zones.updateMask(mask_abrupt);
// [5] TTE Classification: combine zones and abruptness to identify TTE classes
var classNames = ee.List(['Sparse TCC <= 5% & Uniform gradient',
                          'Sparse TCC <= 5% & Diffuse-gradual gradient',
                          'Sparse TCC <= 5% & Diffuse-rapid gradient',
                          'Sparse TCC <= 5% & Abrupt gradient',

                          'Open TCC 6-30% & Uniform gradient',
                          'Open TCC 6-30% & Diffuse-gradual gradient',
                          'Open TCC 6-30% & Diffuse-rapid gradient',
                          'Open TCC 6-30% & Abrupt gradient',
                          
                          'Int. TCC > 30% (TTE ZONES 3 & 4)',
                           
                          'Leading Edge: TCC = 0, Abruptness = 1 - Not-Water Adjacent',
                          'Leading Edge: TCC = 0, Abruptness = 1 - Water Adjacent']);
                          
var tte_class_pal = ['#5255a3','#1796a3','#fdbf6f','#ff7f00',
                     '#ffffbf','#d9ef8b','#91cf60','#1a9850','black','red', 'blue'];
var tte_classification = ee.Image(0).updateMask(mask_abrupt)
                          //SPARSE
                          .where(tte_zones.eq(1).and(tcc_data_abruptness.lte(-0.5)),1 )                                     //CLASS 1: Sporadic TCC <= 5% & Uniform Spatial Rate of Change 
                          .where(tte_zones.eq(1).and(tcc_data_abruptness.gt(-0.5).and(tcc_data_abruptness.lte(0))), 2)      //CLASS 2: Sporadic TCC <= 5% & Diffuse Gradual Spatial Rate of Change
                          .where(tte_zones.eq(1).and(tcc_data_abruptness.gt(0).and(tcc_data_abruptness.lte(0.5))), 3)       //CLASS 3: Sporadic TCC <= 5% & Diffuse Rapid Spatial Rate of Change
                          .where(tte_zones.eq(1).and(tcc_data_abruptness.gt(0.5).and(tcc_data_abruptness.lt(1))), 4)        //CLASS 4: Sporadic TCC <= 5% & Rapid Spatial Rate of Change
                          //OPEN
                          .where(tte_zones.eq(2).and(tcc_data_abruptness.lte(-0.5)), 5)                                     //CLASS 5: Open Canopy TCC 6-30% & Uniform Spatial Rate of Change
                          .where(tte_zones.eq(2).and(tcc_data_abruptness.gt(-0.5).and(tcc_data_abruptness.lte(0))), 6)      //CLASS 6: Open Canopy TCC 6-30% & Diffuse Gradual Spatial Rate of Change
                          .where(tte_zones.eq(2).and(tcc_data_abruptness.gt(0).and(tcc_data_abruptness.lte(0.5))), 7)       //CLASS 7: Open Canopy TCC 6-30% & Diffuse Rapid Spatial Rate of Change
                          .where(tte_zones.eq(2).and(tcc_data_abruptness.gt(0.5)), 8)                                       //CLASS 8: Open Canopy TCC 6-30% & Abrupt Spatial Rate of Change
                          // HIGH cover
                          .where(tte_zones.gte(3), 9)                                                                       //CLASS 9: Intermediate and High Canopy Cover
                          // ABRUPT: The order matters here
                          .where(tte_zones.eq(1).and(tcc_data_abruptness.eq(1)), 10)                                        //CLASS 10: Leading Edge: TCC = 0, Abruptness = 1 - Not-Water Adjacent
                          .where(tte_zones.eq(1).and(tcc_data_abruptness.eq(1)).and(water_ocur.gte(1)), 11)                 //CLASS 11: Leading Edge: TCC = 0, Abruptness = 1 - Water Adjacent

tte_classification = tte_classification
                        .updateMask(tte_classification.gte(0))
                        .reproject(proj_cal_2m, null, TCC_res)

/*
print("Pearson's testing..")
var compare_image = tcc_data.select('tcc_abruptness').addBands(water_ocur)//.addBands(tpi_data.select('tpi_coarse_stand'));
print(compare_image)
var pearsons_image = compare_image
    .reduceNeighborhood({
            reducer: ee.Reducer.pearsonsCorrelation(),
            kernel: ee.Kernel.circle(1000,"meters"),
      })
    // CANNOT get result to show reliably with a reproject-----
    .reproject(proj_cal_2m.atScale(1000));
    //.reproject(cal_2m_tcc.select('b1').projection().atScale(1000));
print(pearsons_image);
*/

///////////////////////////////////////////////
// Map Layers
///////////////////////////////////////////////


//////////
// Good Layers
//////////
/*
Map.addLayer(glcf_water, {}, 'GLCF Inland Water', false)
//Map.addLayer(water_seas, {min:1, max:12, palette: ['#feebe2','#fbb4b9','#f768a1','#c51b8a','#7a0177']}, 'water seasonality', false)
Map.addLayer(water_ocur, {min:1, max:100, palette: ['#f2f0f7','#cbc9e2','#9e9ac8','#756bb1','#54278f']}, 'water occurrence (freq)', false)
//Map.addLayer(water_recur, {min:50, max:100, palette: ['#f1eef6','#bdc9e1','#74a9cf','#2b8cbe','#045a8d']}, 'water recurrance', false)
Map.addLayer(tcc_RelErr.updateMask(tte_domain).updateMask(tcc_RelErr.gt(0)),tcc_relerr_viz,'TCC Relative Error', false);
Map.addLayer(orig_tcc_masked, tcc_viz, "orig_tcc (masked)", false);
Map.addLayer(cal_2m_tcc_masked, tcc_viz, "cal_tcc (masked)", false);                                             
Map.addLayer(tcc_han_2010, tcc_viz, "tcc_han", false);
*/
//Map.addLayer(tcc_2015_mask.updateMask(tcc_RelErr.gt(5)), tcc_viz, "tcc_2015 w/ rel err mask", false);

/*
// Checking abruptness
Map.addLayer(cal_2m_tcc_masked.updateMask(cal_2m_tcc_masked.gt(50)), tcc_viz, "cal_tcc", false);
Map.addLayer(fs.get_abruptness(cal_2m_tcc_masked).select('tcc_spat_rate_chg').updateMask(cal_2m_tcc_masked.gt(50)),{min: 0, max: 90, palette: ['#d7191c','#fdae61','#ffffbf','#a6d96a','#1a9641']}, 'cal_tcc Spat Rate Chnge in Tree Cover', true);
var cal_2m_abrupt_test = fs.get_abruptness(cal_2m_tcc_masked).select('tcc_abruptness').updateMask(cal_2m_tcc_masked.gt(50))
Map.addLayer(cal_2m_abrupt_test, abruptness_viz, "cal tcc abruptness");  
*/
//Map.addLayer(cal_2m_tcc_masked.updateMask(tcc_RelErr.gt(5)), tcc_viz, "cal_tcc w/ rel err mask", false);
//Map.addLayer(orig_tcc_masked.select('tcc_abruptness'), abruptness_viz, "abruptness_orig");    
                         
//Map.addLayer(cal_2m_tcc_masked.select('tcc_abruptness').reproject('EPSG:4326',null,30), abruptness_viz, "abruptness_cal-repro");

//Map.addLayer(tpi_data.select('tpi_fine_stand'), {min: -125, max:125, palette: pal_tpi}, "tpi_fine_stand", false);
//Map.addLayer(tpi_data.select('tpi_coarse_stand'), {min: -125, max:125, palette: pal_tpi}, "tpi_coarse_stand", false);
//Map.addLayer(tpi_data.select('tpi_landforms'), {min: 0, max: 10, palette: pal_land}, "Landforms", false);
//Map.addLayer(TCC_primary, tcc_viz, "TCC Primary (using cal2m mask)", false);

Map.addLayer(tcc_data.select('tcc'), tcc_viz, 'TCC Data', false);
Map.addLayer(tcc_data.select('tcc_spat_rate_chg'), {min: 0, max: 100, palette: ['#ffffb2','#fecc5c','#fd8d3c','#f03b20','#bd0026']}, 'TCC Spat Rate Chnge in Tree Cover', false)
Map.addLayer(tte_zones.mask(tte_zones), tte_zones_viz, 'TTE Zones', false);                                 
Map.addLayer(tcc_data_abruptness, abruptness_viz, "Abruptness", false);

Map.addLayer(tcc_lvis.select('tcc'), tcc_viz, 'TCC (LVIS)', false);
Map.addLayer(tcc_lvis_abruptness, abruptness_viz, "Abruptness (LVIS)", false);

//Map.addLayer(QB_val_pts, {}, 'QB val pts');
//Map.addLayer(plots, {}, 'plots');

Map.addLayer(tte_classification,  {palette: tte_class_pal}, "TTE Classes", false);
//Map.addLayer(tte_classification.reproject(proj_cal_2m, null, TCC_res).sldStyle(sld_intervals), {}, "TTE Classes");
//Map.addLayer(pearsons_image.select('correlation'), {min:-1, max:1, palette: pal_pearson}, 'pearsons cor', false);

Map.addLayer(cavm, {}, 'CAVM', false);
Map.addLayer(LVIS2017, {}, 'LVIS', false);


/*
/////////////////////////////////////////////////////////
// Snow Albedo
/////////////////////////////////////////////////////////
// see Libo Wang email: 8/8/2017
// MCD43A2.006 MODIS BRDF-Albedo Quality, daily 500m
// data constraints: high sun + min snow melt + 2010-2015 + quality flag 0 or 1 = March-April 2010-2015 qual 0 or 1 data
// Relevant Albedo Observations: Temporal, Spatial, & Bit-wise filtering, masking, & reducing
var maskBadPixels = function(image) {                                         //Bit-wise filter: Function to mask bad quality pixels
  var withObs = image.select("BRDF_Albedo_Band_Quality_Band1").lte(1);        //Quality 0 or 1
  return image.updateMask(withObs);
};
var albedo_data = mcd43a2                                                     // Temporal mask: filter image collection
                   .filterDate('2010-04-01', '2015-06-01')                    // 2010-2015
                   .filter(ee.Filter.dayOfYear(74, 84))                     // Mar 14 (~doy 74) - Apr 15 (~doy 105)
var albedo_data_mean = albedo_data.map(maskBadPixels).                        // Spatial mask: out areas that were not observed
    select('BRDF_Albedo_LocalSolarNoon').                                     // Bit-wise select: the data band
    reduce(ee.Reducer.mean())                                                // mean of data band
    .updateMask(tte_domain);                                         // Spatial mask: TCC zones

var brdf_albedo_viz = {min: 61, max: 74, palette: ['#f2f0f7','#cbc9e2','#9e9ac8','#756bb1','#54278f']};
Map.addLayer(albedo_data_mean, brdf_albedo_viz,'High sun & Snow 2010-2015: BRDF_Albedo_LocalSolarNoon', false);                     //MODIS ALBEDO -- toggle on-off
*/

// Make a legend for the abruptness layer
//Map.add(fs.makeLegend(abruptness_viz, '<--  Uniform, Diffuse, Abrupt -->'));

/*
/////////////////////////////////////////////////////////
// TTE Classification Histograms
/////////////////////////////////////////////////////////
var tte_classes = [1,2,3,4,5,6,7,8,9,10,11];
//for testing..
//var hist = ee.Reducer.fixedHistogram(0, 5000, 100).unweighted()
// nice hists here: https://code.earthengine.google.com/3ad5a1afee2105d24e924dc31b1402ca
var r = tte_classification.reduceRegion({
  reducer: ee.Reducer.frequencyHistogram().unweighted(),
  scale: 30,
  geometry: eu_khatanga_roi
});
//print(r)
print("Histograms")
print(tte_classification)
print(ui.Chart.image.histogram(tte_classification.select('constant'), na_brooks_roi,30).setOptions(fs.get_opts_histo('Site: Brooks Range','TTE Classes',tte_classes)));
print(ui.Chart.image.histogram(tte_classification, eu_khatanga_roi,30).setOptions(fs.get_opts_histo('Site: Khatanga','TTE Classes',tte_classes)));
print(ui.Chart.image.histogram(tte_classification, na_hudwest_roi,30).setOptions(fs.get_opts_histo('Site: Hudson Bay West','TTE Classes',tte_classes)));
print(ui.Chart.image.histogram(tte_classification, eu_west_roi,30).setOptions(fs.get_opts_histo('Site: Ob River, Western Eu.','TTE Classes',tte_classes)));
// Abruptness histograms.
var abrupt_classes = [-1,-0.5,0,0.5,1];
print(ui.Chart.image.histogram(tcc_data_abruptness, na_brooks_roi,30).setOptions(fs.get_opts_histo('Site: Brooks Range','Abruptness',abrupt_classes)));
print(ui.Chart.image.histogram(tcc_data_abruptness, na_hudwest_roi,30).setOptions(fs.get_opts_histo('Site: NA Hudwest','Abruptness',abrupt_classes)));
print(ui.Chart.image.histogram(tcc_data_abruptness, eu_khatanga_roi,30).setOptions(fs.get_opts_histo('Site: Khatanga','Abruptness',abrupt_classes)));
print(ui.Chart.image.histogram(tcc_data_abruptness, eu_west_roi,30).setOptions(fs.get_opts_histo('Site: Ob River, Western Eu.','Abruptness', abrupt_classes)));
Map.setOptions('TERRAIN');
*/


/////////////////////////////////////////////////////////
// Export The Stacked TCC Result
/////////////////////////////////////////////////////////
var tte_data_export = ee.Image.cat([tte_domain, tte_zones, tcc_data_abruptness, tte_classification, tcc_data.select('tcc')])
                  .rename(['tte_domain','tte_zones','tte_abruptness','tte_classification', 'tcc']);

// Function to standardize the export
var EXPORT_TTE_DATA = function(input_image, res, output_name, xmin, ymin, xmax, ymax){
  var xmin_360 = 180 + xmin;
  var asset_extent = ee.Geometry.Rectangle([xmin, ymin, xmax, ymax], 'EPSG:4326', false);
  //Map.addLayer(asset_extent, {}, 'asset_extent');
  Export.image.toAsset({
    image: input_image.clip(asset_extent), 
    description: output_name ,    //+"_"+ymax+"_"+xmin_360, 
    assetId: output_name ,        //+"_"+ymax+"_"+xmin_360,
    pyramidingPolicy:  {".default": "mode"},
    scale: res,
    region: asset_extent,
    maxPixels:1e13
  });
};

// EXPORT DATA TO ASSET
EXPORT_TTE_DATA(tte_data_export, 30, "TTE_DATA_v20190"+num_month+"v2", -180, 45, 180, 75)
//EXPORT_TTE_DATA(clim_envelope_10, "bioclim_isotherm_10C_wrm_qrt",-180,45, 180, 75);
EXPORT_TTE_DATA(bioclim_env_tte, 1000, "BIOCLIM_ENV_TTE", -180, 45, 180, 75) // bioclim_env_tte.projection().nominalScale().round();

// This creates a BAD shp...
var bioclim_env_tte_vectors = bioclim_env_tte.toInt().reduceToVectors({
  reducer: ee.Reducer.countEvery(), 
  geometry: ee.Geometry.Rectangle([-180, 45, 180, 80], 'EPSG:4326', false), 
  scale: 5000,
  maxPixels: 1e12
});
Export.table.toDrive({
        collection: bioclim_env_tte_vectors,
        description: 'BIOCLIM_ENV_TTE_vectors',
        folder: 'TTE',
        fileNamePrefix: 'BIOCLIM_ENV_TTE_vectors',
        fileFormat: 'SHP'
      });

/*
Numbers: see TTE_map
Get csv of area of certain pixel class for each feature in fc: https://code.earthengine.google.com/6aac9f90de4f1f438090f8844d4413f8
*/
fs.makeMapGrey()
