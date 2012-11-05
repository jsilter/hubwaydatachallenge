/*
Copyright (c) 2012, Jacob Silterra
All rights reserved.
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>
*/

//Should be imported already from a separate file
var GOOGLE_BROWSER_KEY = GOOGLE_BROWSER_KEY;
google.load('visualization', '1', {packages: ['corechart']});

var fusion_query_url="https://www.googleapis.com/fusiontables/v1/query";
var google_shorten_url="https://www.googleapis.com/urlshortener/v1/url";

//Google table IDs. These may be taken down at any time,
//it is suggested you create your own fusion table
var stationTableId = "1TYoxLzEiq38FCr5N6iP-x_IF5JcP4qvuiH0vUvo";
//Contains a 5% sample. Loads faster, useful for testing
var testTripTableId = "1PEvVQaoTQ29WdGQr-XdlbZS2ocX6Z1xqFXlsjeo";
var fullTripTableId = "1XbTMbt4SDu8HBfJ7mJKTv5m9NLWyupfyfVudu0g";
//census data
var populationTableId = "1slogrMbvfK9uhACNjDBjwf9aiTzM4vfgRo6GRNY"
var tripTableId = fullTripTableId;


var weekends = ["#liSat", "#liSun"];
var weekdays = ["#liMon", "#liTue", "#liWed", "#liThu", "#liFri"];
//-----------------------//

var timeColName = "start_time"

var MINUTES_IN_DAY = 24*60;
//For retrying on failure
var MIN_RETRY_INTERVAL = 0.2;
var retryInterval = MIN_RETRY_INTERVAL;

var stationSizeScale = 10;
var stationColorScale = 500;
var timeIncrMin = 15;
var timeHalfWidth = timeIncrMin;
var startLat = 42.357053;
var startLng = -71.092622;
var startZoom = 14;

var defStationOpacity = 0.6;
//When a station is clicked, we show outgoing arrows
//To keep the graph clean, we only show the top
//maxNumberArrows destinations
var maxNumberArrows = 5;

//Only allow at most maxNumSelected stations to be selected at once
var maxNumSelected = 1;
var selectedIds = [];

//Gets rewritten in initialize. Used for shortening URL
var base_url = "http://www.example.com/hubway_map.html"

var isPlaying = false;
var counterId = -1;

var map;
var dayChart, barChart;
var bikeLayer;
var popLayer;

var stationMarkers = {};
var maxCacheSize = 5;
var responseCache = new ResponseCache(maxCacheSize);

function ResponseCache(maxNum){
	this.maxNum = maxNum;
	this.objects = {};
	this.keys = []

	this.put = function(key, object){
		if(!(key in this.objects)){
			this.keys.push(key);
		}
		this.objects[key] = object;

		if(this.keys.length > maxNum){
			var remkey = this.keys.shift();
			delete this.objects[remkey];
		}
	}

	//Get the object represented by key,
	//or null if it doesn't exist.
	//The object is left in the cache
	this.get = function(key){
		if(key in this.objects){
			return this.objects[key];
		}else{
			return null;
		}
	}

	this.pop = function(key){
		var index = this.keys.indexOf(key);
		if(index >= 0){
			var obj = this.objects[key];
			delete this.objects[key];
			this.keys.splice(index, 1);
		}else{
			return null;
		}
	}

	this.clear = function(){
		this.objects = {};
		this.keys = [];
	}
}

/*
Convert minutes to string of form HH:MM
Negative is set to 0, higher than a day is 24:00
This is for querying times based on them being strings
*/
function getHourMinStr(minutes){
	minutes = Math.max(0, minutes);
	minutes = Math.min(MINUTES_IN_DAY, minutes);

    var hours = (minutes / 60 ) >> 0;
    var rem = minutes - hours*60;
    if(hours < 10){
        hours = "0" + hours;
    }

    if(rem < 10){
        rem = "0" + rem;
    }
    return hours + ":" + rem;
}

function getMinutes(hourMinStr){
	var tokens = hourMinStr.split(':');
	var hours = parseInt(tokens[0], 10);
	var minutes = parseInt(tokens[1], 10);
	return hours*60 + minutes;
}

$(document).ready(initialize);
function initialize()
{
	initializeMenu();


    $("#nojavascript").hide();
	base_url = $.url().attr('source').split('?')[0];

    changesEnabled = false;
    initializeControls();
    parseURLparams($.url().param());
    changesEnabled = true;
    initializeMap();
}

/*
Generate string containing all necessary query parameters
to recreate this graph
*/
function createURLParams(){
	out_comps = ["time=" + getSliderTimeBounds()];
	out_comps.push("stationSizeScale=" + stationSizeScale);
	out_comps.push("stationColorScale=" + stationColorScale);
	out_comps.push("dow=" + getDOWString());
	out_comps.push("showPopulation=" + $('#show-population').prop('checked'));
    out_comps.push("showBike=" + $('#show-bike').prop('checked'));
    var center = map.getCenter();
	out_comps.push("lat=" + center.lat());
	out_comps.push("lng=" + center.lng());
	out_comps.push("zoom=" + map.getZoom());
	out_str = out_comps.join("&");
	console.log(out_str);
	return out_str;
}

function parseURLparams(params){
    changesEnabled = false;
    if("time" in params){
        setTimeValue(params.time, true);
    }
    if("stationSizeScale" in params){
        setStationSizeScale(params.stationSizeScale, true);
    }
    if("stationColorScale" in params){
        setStationColorScale(params.stationColorScale, true);
    }
    if("dow" in params){
        //Comma separated list of day numbers
        dayNums = params.dow.split(",");

        $('#week li').each(function() {
            var isActive = this.value in dayNums;

            $(this).removeClass("activated_day unactived_day");
            if(isActive)
            {
                $(this).addClass("activated_day")
            }
            else
            {
                $(this).addClass("unactived_day");
            }
        });
        /*$('#DOW>:checkbox').each(function() {
            this.checked = this.value in dayNums;
        });*/

    }
	if("showPopulation" in params){
		$('#show-population').prop('checked', params.showPopulation == 'true');
	}
	if("showBike" in params){
        $('#show-bike').prop('checked', params.showBike == 'true');
    }
    changesEnabled = true;
	if("lat" in params){
		startLat = params.lat;
	}
	if("lng" in params){
		startLng = params.lng;
	}
	if("zoom" in params){
		startZoom = parseInt(params.zoom, 10);
	}
}

var changesEnabled = true;
function initializeControls(){
    $("#controls").show();
    initializeTimeSlider();
    initializeStationScaleSlider();
    initializeStationColorSlider();

    $("#week li").click(function(){
        if(changesEnabled){
            displayTrips(getSliderTimeBounds());
            //Do this in updateStationSelected
            if(false && selectedIds){
            	for(ind in selectedIds){
					var stationMarker = stationMarkers[selectedIds[ind]];
					//setTimeout(function(){redrawDayGraph(stationMarker)}, 100);
					//setTimeout(function(){redrawActivityBarGraph(stationMarker)}, 100);
            	}
            }
        }
    });

    $('#weekday-button').click(getMultiCheckBoxSelector(weekdays));
    $('#weekend-button').click(getMultiCheckBoxSelector(weekends));

	$('#show-population').change(function(){
		if(this.checked){
			popLayer.setMap(map);
		}else{
			popLayer.setMap(null);
		}
	});

    $('#show-bike').change(function(){
        if(this.checked){
            map.setMapTypeId(google.maps.MapTypeId.ROADMAP);
            bikeLayer.setMap(map);
        }else{
            map.setMapTypeId('map_style');
            bikeLayer.setMap(null);
        }
    });

	$('#share-button').click(function(){
		var permalink = base_url + "?" + createURLParams();
		$.ajax({url: google_shorten_url,
				type: 'POST',
				data: JSON.stringify({"longUrl": permalink}),
				dataType: "json",
				contentType: "application/json",
				success: function(data){
							$('#permalink-text').text(data['id']);
							$('#permalink-dialog').dialog();
							},
                error: errorHandler
				});
		});

	$('#play-button').click(function(){
		//$("#myTimeSlider").slider('value', 0);
		isPlaying = !isPlaying;
		if(isPlaying){
			//Fill up cache
			setLoading(true);
			var initTime= getSliderTimeBounds()[0];
			for(var ii= 0; ii < maxCacheSize; ii++){
				var loadTime = initTime + ii*timeIncrMin;
				//console.log("preloading " + loadTime);
				downloadTrips(loadTime);
			}
			setLoading(false);
			counterId = setInterval(incrTimeForPlay, 500);
		}else{
			clearInterval(counterId);
		}
	});


}

function incrTimeForPlay(){
	var initBounds = getSliderTimeBounds();
	var newBounds = [initBounds[0] + timeIncrMin, initBounds[1] + timeIncrMin];
	if(newBounds[1] > MINUTES_IN_DAY - 1){
		clearInterval(counterId);
		isPlaying = false;
		//setTimeValues([0, 2*60, true);
	}else{
		setTimeValues(newBounds, true);
		//Download the next one
		var loadTime = [newBounds[0] + (maxCacheSize-1)*timeIncrMin,
							newBounds[1] + (maxCacheSize-1)*timeIncrMin];
		downloadTrips(loadTime);
	}
}


/*
 *    Return a function which checks all boxes if any are unchecked,
 *    provided they match the given checkBoxSelector. If all are checked,
 *    they are all unchecked.
 */
function getMultiCheckBoxSelector(daySelectors){
    return function(){
        var allSelected = true;
        for(var i=0; i<daySelectors.length; i++)
        {
            allSelected &= $(daySelectors[i]).hasClass("activated_day");
        }

        changesEnabled = false;
        //Deselect all iff all selected
        for(var i=0; i<daySelectors.length; i++)
        {
            $(daySelectors[i]).removeClass("activated_day unactivated_day");
            if(allSelected){
                $(daySelectors[i]).addClass("unactivated_day")
            }else{
                $(daySelectors[i]).addClass("activated_day");
            }
        }

        changesEnabled = true;
        displayTrips(getSliderTimeBounds());
    };

}

/*
 *    Return a function which checks all boxes if any are unchecked,
 *    provided they match the given checkBoxSelector. If all are checked,
 *    they are all unchecked.
 *
function getMultiCheckBoxSelector(checkBoxSelector){
    return function(){
        var allSelected = true;
        $(checkBoxSelector).each(function(){
            allSelected &= this.hasClass("activated_day");
        });

        changesEnabled = false;
        $(checkBoxSelector).each(function(){
            this.checked = !allSelected;
        });
        changesEnabled = true;
        displayTrips(getSliderTime());
    };

}
*/



function setStationSizeScale(uivalue, setUI){
    if(setUI){
        $(".controlSlider#stationSizeScale").slider('value', uivalue)
    }
    stationSizeScale = uivalue
    redrawStations();
}

function setStationColorScale(uivalue, setUI){
    if(setUI){
        $(".controlSlider#stationColorScale").slider('value', uivalue)
    }
    stationColorScale = uivalue
    redrawStations();
}

function setTimeValues(values, setUI){
    if(setUI){
        $("#myTimeSlider").slider('values', values);
    }
    $("#myTimeLabel").text(getHourMinStr(values[0]) + "-" + getHourMinStr(values[1]));
}

function setLoading(loading){
    var selector = "#ajax-loading";
    if(loading){
        $("#error-display").hide();
        $(selector).show();
    }else{
        $(selector).hide();
    }
}

function initializeTimeSlider(){
    var max = MINUTES_IN_DAY - 1;
	var initValues = [11*60, 13*60];
    var slider = $("#myTimeSlider").slider({
		range: true,
        step: timeIncrMin,
        min: 0,
        max: max,
		values: initValues,
        slide: function(event, ui){
            setTimeValues(ui.values, false);
        }
    });
    //Don't want to query when initializing slider,
    //so we set the change listener after
    setTimeValues(initValues, true);
    slider.bind('slidechange', function(event, ui){
        displayTrips(getSliderTimeBounds());
    });
}

function initializeStationScaleSlider(){

    var max = stationSizeScale*2;
    var slider = $(".controlSlider#stationSizeScale").slider({
		orientation: "vertical",
        step: max/100,
        value: stationSizeScale,
        min: 1,
        max: max,
        slide: function(event, ui){
            setStationSizeScale(ui.value, false);
        }
    });
    var value = slider.slider('value');
    //setStationSizeScale(value);
}

function initializeStationColorSlider(){

    var max = stationColorScale*2;
    var slider = $(".controlSlider#stationColorScale").slider({
		orientation: "vertical",
        step: max/100,
        value: stationColorScale,
        min: 1,
        max: max,
        slide: function(event, ui){
            setStationColorScale(ui.value, false);
        }
    });
    var value = slider.slider('value');
    //setStationColorScale(value, false);
}

function initializeMap(){
        // Create an array of styles.
  var styles = [
      {
        "featureType": "administrative.country",
        "elementType": "geometry.fill",
        "stylers": [
          { "visibility": "on" },
          { "color": "#f9f9fb" }
        ]
      },{
        "featureType": "landscape.natural",
        "elementType": "geometry.fill",
        "stylers": [
          { "color": "#f9f9fb" }
        ]
      },{
        "featureType": "administrative.country",
        "elementType": "labels",
        "stylers": [
          { "visibility": "off" }
        ]
      },{
        "featureType": "administrative.province",
        "elementType": "labels",
        "stylers": [
          { "visibility": "off" }
        ]
      },{
        "featureType": "road.highway",
        "stylers": [
          { "visibility": "off" }
        ]
      },{
        "featureType": "poi",
        "elementType": "geometry.fill",
        "stylers": [
          { "visibility": "on" },
          { "color": "#c1ccce" }
        ]
      },{
        "featureType": "road",
        "elementType": "geometry.fill",
        "stylers": [
          { "color": "#e6ecf3" }
        ]
      },{
        "featureType": "road",
        "elementType": "labels.text.stroke",
        "stylers": [
          { "visibility": "on" },
          { "color": "#eaeaea" }
        ]
      },{
        "featureType": "water",
        "stylers": [
          { "visibility": "on" },
          { "saturation": -17 },
          { "color": "#a1bfc5" },
          { "lightness": 9 }
        ]
      },{
        "featureType": "landscape",
        "stylers": [
          { "color": "#f9f9fb" }
        ]
      }
  ];

  // Create a new StyledMapType object, passing it the array of styles,
  // as well as the name to be displayed on the map type control.
  var styledMap = new google.maps.StyledMapType(styles,
    {name: "Minimalist"});

  // Create a map object, and include the MapTypeId to add
  // to the map type control.
  var mapOptions =
  {
    center: new google.maps.LatLng(startLat, startLng),
    zoom: startZoom,
    panControl: false,
    zoomControl: false,
    scaleControl: false,
    streetViewControl: false,
    mapTypeControlOptions: {
      mapTypeIds: [google.maps.MapTypeId.ROADMAP, 'map_style']
    }
  };
  map = new google.maps.Map(document.getElementById('map_canvas'),
    mapOptions);

  //Associate the styled map with the MapTypeId and set it to display.
  map.mapTypes.set('map_style', styledMap);
  map.setMapTypeId('map_style');

  bikeLayer = new google.maps.BicyclingLayer();
  $('#show-bike').change();

	//Add fusion layer with population
	popLayer = new google.maps.FusionTablesLayer({
		query: {
			select: 'border_points',
			from: populationTableId,
			where: 'POP10 > 0'
			},
			heatmap: {enabled: false}
		});

  queryStations();

	$('#show-population').change();
}

/*
 *    Get location of hubway stations. We could use the FusionTables API
 *    for this (see https://developers.google.com/maps/documentation/javascript/layers#FusionTables), but
 *    since I want to build an object of the stations for later plotting I'm doing it manually
 */
function queryStations(){
    setLoading(true);
    clearStationMarkers();

    var sql_text = "SELECT id, name, lat, lng, days_active FROM " + stationTableId;

    var full_query_url = fusion_query_url + "?key=" + GOOGLE_BROWSER_KEY;
    full_query_url += "&sql=" + sql_text;

    //console.log(full_query_url);
    $.get(full_query_url, stationDataHandler);

}

function getDOWString(){
    //Dummy value just so it's never empty
    var allVals = ["-1"];

    $("#week li").each(function(n) {
           if($(this).hasClass("activated_day"))
           {
                allVals.push(this.value);
           }
      });

    /*$('#DOW>:checkbox').each(function() {
        if(this.checked){
            allVals.push(this.value);
        }
    });*/

    return allVals.join(",");
}

function getDOWCount(){
    var count = 0;
    $("#week li").each(function() {
        if($(this).hasClass("activated_day")){
            count += 1
        }
    });
    return count;
}

function scaleByDOW(scalar){

    //What we want is average among days selected,
    //so we scale up when some not selected
    //Neglect the edge effects from days_active not being
    //a multiple of 7
    var DOWCount = getDOWCount();
    if(DOWCount > 0){
        var DOWScale = 7.0/DOWCount;
        if(DOWScale != 1.0){
            scalar *= DOWScale;
        }
    }
    return scalar;
}

//Linearly interpolate flux to get color
//red if negative, green if positive
//We fix the saturation, move intensity from high (white)
//to low (colored) as colorValue increases
function getColorStr(colorValue){
	var path = false;

    var colorValue = Math.floor(colorValue);
    var absColor = Math.abs(colorValue);
    var minIntens = 40;
    var maxIntens = 65;
    var intens =  Math.max(Math.min(maxIntens - Math.abs(absColor), maxIntens), minIntens);
    var saturation = 100;
    var posHue = 80;
    var negHue = 20;
    var pathHue = 34;

    var colorStr = "hsl("
    if(path){
        colorStr +=  pathHue;
    }else if(colorValue >= 0){
        colorStr += posHue;
    }else{
        colorStr += negHue;
    }
    colorStr += "," + saturation + "%," + intens + "%)"
    return colorStr;
}

function getSliderTimeBounds(){
	return $("#myTimeSlider").slider('values');
}
/*
 *    Get a clause suitable for SQL based on time controls
 */
function getDateTimeClause(timeBounds){
    var dowString = getDOWString();

    var minTimeStr = getHourMinStr(timeBounds[0]);
    var maxTimeStr = getHourMinStr(timeBounds[1]);

    //Note the single quotes around the time
    var outStr = timeColName + " >= '" + minTimeStr + "' AND " + timeColName + " < '" + maxTimeStr + "'";
    outStr += " AND " + "start_dow IN (" + dowString + ")";

    return outStr;
}

function generateTripQueryURL(timeBounds){
	//This throws a parser error sometimes due to Nan or Null when ids are bad, so we apply a rather pointless filter
    var sql_text = "SELECT start_station_id, end_station_id, COUNT() AS outgoing";
	//sql_text += ", min_station_id"
	sql_text += " FROM " + tripTableId;
    sql_text += " WHERE start_station_id >= 0 AND end_station_id >= 0";

    //Filter by time and day of week.
    sql_text += " AND " + getDateTimeClause(timeBounds);
    //Only interested in aggregate statistics here
    sql_text += " GROUP BY start_station_id, end_station_id"; //,min_station_id
	//So we can render one station at a time
	//sql_text += " ORDER BY min_station_id";

    var full_query_url = fusion_query_url + "?key=" + GOOGLE_BROWSER_KEY;
    full_query_url += "&sql=" + sql_text;

	return full_query_url;
}
function displayTrips(timeBounds){
	if(!changesEnabled){
		return downloadTrips(midTimeVal);
	}
	var cacheKey = timeBounds + getDOWString();
	//console.log(cacheKey);
    var handler = getDisplayTripHandler(cacheKey);
	return downloadOrDisplayTrips(timeBounds, cacheKey, handler);
}

function downloadTrips(timeBounds){
	var cacheKey = timeBounds + getDOWString();
    var handler = getDownloadTripHandler(cacheKey);
	return downloadOrDisplayTrips(timeBounds, cacheKey, handler);
}

function downloadOrDisplayTrips(timeBounds, cacheKey, handler){
	setLoading(true);
	var full_query_url = generateTripQueryURL(timeBounds);

	//Check cache, use that value if we have it
	var jsonResponse = responseCache.get(cacheKey);

	if(jsonResponse != null){
		setTimeout(function(){handler(jsonResponse)}, 0);
	}else{
		$.ajax({url: full_query_url, success: handler,
			error: tripErrorHandler});
	}
}
function tripErrorHandler(jqXHR, textStatus, errorThrown){
	retryInterval *= 1.5;

	if(jqXHR.status >= 500){
		console.log("tripErrorHandler retrying");
		errorThrown = "Error loading trip data; retrying in " + retryInterval.toFixed(2) + " seconds";
		setTimeout(function(){displayTrips(getSliderTimeBounds());}, retryInterval*1000);
	}

	errorHandler(jqXHR, textStatus, errorThrown);
}

function errorHandler(jqXHR, textStatus, errorThrown){
    console.log(jqXHR);
    console.log(textStatus);
    console.log(errorThrown);
    setLoading(false);
    $("#error-display").html("Error loading data: " + errorThrown).show();
}

//Handler for downloading data from server (or retrieving from cache)
//and displaying trip data.
function getDisplayTripHandler(cacheKey){
	return function(serverResponse){
		var jsonResponse = tripDataHandler(serverResponse);
		responseCache.put(cacheKey, jsonResponse);
		retryInterval = MIN_RETRY_INTERVAL;
		setLoading(false);
	};
}

//Handler for downloading data from server and caching it,
//it is not displayed. Always cache jsonResponse, don't want to
//parse it twice.
function getDownloadTripHandler(cacheKey){
	return function(response){
		if((typeof response) == "string"){
			response = $.parseJSON(response);
		}
		responseCache.put(cacheKey, response);
		retryInterval = MIN_RETRY_INTERVAL;
		setLoading(false);
	};
}

function tripDataHandler(response) {
    //What a hack. instanceof didn't work
    if((typeof response) == "string"){
        response = $.parseJSON(response);
    }

    var columns = response.columns;

    var startIdCol = columns.indexOf('start_station_id');
    var endIdCol = columns.indexOf('end_station_id');
    var outgoingCol = columns.indexOf('outgoing');

	mapFunctionStations(resetStationStatistics);
    if(!("rows" in response)){
        response.rows = [];
    }

    var rows = response.rows;
    for (var i = 0; i < rows.length; i++) {
        var item = rows[i];

        var startId = item[startIdCol]
        var endId = item[endIdCol]
		//var minId = parseInt(item[minIdCol]);

        var numOutgoing = parseInt(item[outgoingCol], 10);

        startMarker = stationMarkers[startId];
        endMarker = stationMarkers[endId];

        incrMarkerValues(startMarker.outgoing, endId, numOutgoing);
        incrMarkerValues(endMarker.incoming, startId, numOutgoing);
    }

	redrawStations();

    setLoading(false);
	return response;
}

/*
    *    transitObj should be incoming/outgoing of a stationMarker
    *    otherId is the source/destination of the trip
    *    value is the amount by which to increment
    *    Make sure the weights are initialized first
    */
function incrMarkerValues(transitObj, otherId, value){
    transitObj.total += value;
    transitObj.weights[otherId] += value;
}

function recalcStationProps(stationMarker){

        //var stationMarker = stationMarkers[station_id];
        var activity = stationMarker.outgoing.total + stationMarker.incoming.total;
        var flux = stationMarker.outgoing.total - stationMarker.incoming.total;

        activity /= stationMarker.days_active;
        flux /= stationMarker.days_active;

        activity = scaleByDOW(activity);
        flux = scaleByDOW(flux);

        stationMarker.title = stationMarker.name;
        stationMarker.title += "\nAvg. Daily Activity: " + activity.toFixed(2) + " trips";
        stationMarker.title += "\nAvg. Daily Flux: " + flux.toFixed(2) +
        " trips";

		var cur_scale = Math.sqrt(activity) * stationSizeScale;
		cur_scale = Math.max(2, cur_scale);

        var colorStr = getColorStr(flux * stationColorScale);
        //We add the color to the station, because we mess with the marker
        //color when the marker is selected

        var tempIcon = stationMarker.getIcon();

        tempIcon.fillOpacity = defStationOpacity;
        tempIcon.scale = cur_scale;

        stationMarker.tripColorStr = colorStr;
        tempIcon.fillColor = colorStr;

        stationMarker.setIcon(tempIcon);
}


function redrawStations(){
	mapFunctionStations(recalcStationProps);
    mapFunctionStations(updateStationSelected);
    //mapFunctionStationsAsync(revalidateStation);
}

function revalidateStation(station){
    station.setMap(map);
}

function stationDataHandler(response) {

    //What a hack. instanceof didn't work
    if((typeof response) == "string"){
        response = $.parseJSON(response);
    }
    var rows = response.rows;
    var columns = response.columns;

    var idCol = columns.indexOf('id');
    var nameCol = columns.indexOf('name');
    var latCol = columns.indexOf('lat');
    var lngCol = columns.indexOf('lng');
    var days_activeCol = columns.indexOf('days_active');

    for (var i = 0; i < rows.length; i++) {
        var item = rows[i];
        var name = item[nameCol];
        var id = item[idCol];

        var marker = new google.maps.Marker({
            id: id,
            position: new google.maps.LatLng(item[latCol], item[lngCol]),
                                            days_active: item[days_activeCol],
                                            icon: {
                                                path: google.maps.SymbolPath.CIRCLE,
                                            scale: 1,
                                            strokeOpacity: 0.4,
                                            strokeWeight: 1,
                                            fillColor: "#FFFFFF",
                                            fillOpacity: defStationOpacity,
                                            },
                                            map: map,
                                            name: name,
                                            title: name,
                                            selected: false
        });
    setStationMarkerListeners(marker);
    stationMarkers[id] = marker;
    }
    displayTrips(getSliderTimeBounds());
}


var lineSymbol = {path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW};
/**
    *    Initializes events for a single station marker
    */
function setStationMarkerListeners(stationMarker){
    google.maps.event.addListener(stationMarker, 'click', function() {
        this.selected = !this.selected;
		updateStationSelected(this);
		revalidateStation(this);
        var thisStationId = this.id;
		//Add or remove to selected list
		if(this.selected){
            selectedIds.push(thisStationId);
            //setTimeout(function(){updateDayChart(thisStationId)}, 100);
			//setTimeout(function(){redrawActivityBarGraph(stationMarker)}, 100);
		}else{
			var index = selectedIds.indexOf(thisStationId);
			if(index >= 0){
				selectedIds.splice(index, 1);
			}
		}

		var toDesel = [];
		while(selectedIds.length > maxNumSelected){
			var stationId = selectedIds.shift();
            toDesel.push(stationId);
        }
        for(var ind in toDesel){
            var stationId = toDesel[ind];
			var deselStation = stationMarkers[stationId];
			deselStation.selected = false;
			updateStationSelected(deselStation);
			revalidateStation(deselStation);
		}

		if(selectedIds.length <= 0){
			$("#bar_chart").hide();
            $("#bar_chartInstruction").show();
            mapFunctionStationsAsync(resetMarker);
		}
    });
}


function getAllDayTripQueryURL(stationId, isStart){
	var id_col_name = "start_station_id";
	if(!isStart){
		id_col_name = "end_station_id";
	}
	var sql_text = "SELECT start_station_id, end_station_id, " + timeColName + ",COUNT() AS outgoing";
	sql_text += " FROM " + tripTableId;
	sql_text += " WHERE " + id_col_name + " = " + stationId;
	sql_text += " AND " + "start_dow IN (" + getDOWString() + ")";
	sql_text += " GROUP BY start_station_id, end_station_id, " + timeColName;

	var full_query_url = fusion_query_url + "?key=" + GOOGLE_BROWSER_KEY;
    full_query_url += "&sql=" + sql_text;
	return full_query_url
}
function updateDayChart(stationId){

	if(dayChart){
		//Blank out dayChart while we load
		var data = google.visualization.arrayToDataTable([
			['Time', 'Loading'],
			['', 0],
		   ]);
		dayChart.draw(data, {});
		$("#day_chart").show();
	}
	var station = stationMarkers[stationId];
	station.allDayTrips = {};
	var handler = getAllDayTripHandler(station);

	var startURL = getAllDayTripQueryURL(stationId, true);
	$.ajax({url: startURL, success: handler,
			error: tripErrorHandler});

	var endURL = getAllDayTripQueryURL(stationId, false);
	var graphHandler = function(response){
		handler(response);
		redrawDayGraph(station);
	}
	$.ajax({url: endURL, success: graphHandler,
			error: tripErrorHandler});

}

function getAllDayTripHandler(station){
	return function(response){
			if((typeof response) == "string"){
				response = $.parseJSON(response);
			}

			var columns = response.columns;

			var startIdCol = columns.indexOf('start_station_id');
			var endIdCol = columns.indexOf('end_station_id');
			var outgoingCol = columns.indexOf('outgoing');
			var timeCol = columns.indexOf(timeColName);

			if(!("rows" in response)){
				response.rows = [];
			}

			var rows = response.rows;
			var item, timeStr, minutes, outgoing, adjTime;
			var bucketSize = timeIncrMin;
			var allDayTrips = station.allDayTrips;

			for (var i = 0; i < rows.length; i++) {
				item = rows[i];

				timeStr = item[timeCol];
				minutes = getMinutes(timeStr);
				adjTime = minutes - timeHalfWidth;
				if(adjTime < 0){
					adjTime = MINUTES_IN_DAY + adjTime;
				}
				bucket = bucketSize*Math.floor(adjTime/bucketSize);
				outgoing = parseInt(item[outgoingCol], 10);

				if(bucket in allDayTrips){
					allDayTrips[bucket] += outgoing;
				}else{
					allDayTrips[bucket] = outgoing;
				}
			}
	}
}

function redrawDayGraph(station){
	var data = new google.visualization.DataTable();
	data.addColumn('string', 'Time');
	data.addColumn('number', 'Avg. Activity');
	var rows = [];
	for (var minBucket in station.allDayTrips) {
		var timeStr = getHourMinStr(minBucket);
		var activity = station.allDayTrips[minBucket];
		activity /= station.days_active;
		activity = scaleByDOW(activity);
		rows.push([timeStr, activity]);
	}
	data.addRows(rows);

	dayChart = new google.visualization.LineChart(document.getElementById('day_chart'));
	var options = {title: station.name + ' Activity',
					height: 600};
	dayChart.draw(data, options);
}

function redrawActivityBarGraph(station){
    $("#bar_chartInstruction").hide();
	var data = new google.visualization.DataTable();
	data.addColumn('string', 'Station');
	data.addColumn('number', 'Going to');
	data.addColumn('number', 'Coming from');

	//Add up to get total activity
	//Only select the top 10
	activities = {}
	var stationIds = getAllStationIds();
	for(var destIndex in stationIds){
		var destId = stationIds[destIndex];
		var activity = station.outgoing.weights[destId] + station.incoming.weights[destId];
		activity /= Math.min(station.days_active, stationMarkers[destId].days_active);
		activity = scaleByDOW(activity);
		activities[destId] = activity;
	}
	var destIds = getSortedIds(activities, maxNumberArrows*2);

	var rows = [];
	var days_active = station.days_active;
	for (var outgoingIndex in destIds) {
		var outgoingId = destIds[outgoingIndex];
		if(outgoingId == station.id){
			continue;
		}
		var outgoing = station.outgoing.weights[outgoingId]/days_active;
		var incoming = station.incoming.weights[outgoingId]/days_active;
		outgoing = scaleByDOW(outgoing);
		incoming = scaleByDOW(incoming);
		var name = stationMarkers[outgoingId].name;
		rows.push([name, outgoing, incoming]);
	}
	data.addRows(rows);

	barChart = new google.visualization.BarChart(document.getElementById('bar_chart'));
	var options = {title: station.name + ' Destinations',
					height: 600,
					isStacked: true,
                    colors: ['#b1d147', '#D05006'],
                    titleTextStyle: {color: '#6F6F6F', fontName: 'Londrina Solid', fontSize: 20},
                    vAxis: {textStyle: {color: '#6F6F6F', fontName: 'Times', fontSize: 16}},
                    hAxis: {textStyle: {color: '#6F6F6F', fontName: 'Times', fontSize: 16}},
                    legend: {position: 'top', textStyle: {color: '#6F6F6F', fontName: 'Times', fontSize: 16}},
                    chartArea: {left: 300}
                  };

	barChart.draw(data, options);
}

/*
Get a list of ids which represent the largest
maxNum (sorted descending) of the values in `weights`
*/
function getSortedIds(weights, maxNum){
	var ids = [];
    for(id in weights){
        ids.push(id);
    }
    ids.sort(function(a_id, b_id){
        return weights[b_id] - weights[a_id];
    });
    if(ids.length > maxNum){
        ids = ids.slice(0, maxNum);
    }
    return ids;
}

/**
Draw a marker from main to other if `outgoing` is true,
or from other to main if false.
The reason for that last parameter is we ALWAYS store a pointer for the path
in `mainMarker`, and also the weight is taken from mainMarker.outgoing if `outgoing`
and otherMarker.outgoing if not.
*/
function drawPath(mainMarker, otherMarker, outgoing){
	//source and dest are active for a different number of days
	//Scale by min
	var days_active = Math.min(mainMarker.days_active, otherMarker.days_active);
	var weight = mainMarker.outgoing.weights[otherMarker.id];
	if(!outgoing){
		weight = otherMarker.outgoing.weights[mainMarker.id];
	}

	weight *= 20.0 / days_active;
	weight = scaleByDOW(weight);
	weight = Math.min(10, weight);
	//var colorWeight = weight;
  var strokeColor = mainMarker.getIcon().fillColor;

  //var isRed = (strokeColor[4] < 5);

	/*if(!outgoing){
		colorWeight *= -colorWeight;
	}
	var strokeColor = getColorStr(colorWeight*stationColorScale/50);*/
	if(otherMarker.id == mainMarker.id){
		var pathCoords = generateSelfLoop(mainMarker.position);
	}else{
		if(!outgoing){
			var pathCoords = generateCurvedLine(otherMarker.position,
											mainMarker.position, 4);
		}else{
			var pathCoords = generateCurvedLine(mainMarker.position,
											otherMarker.position, 4);
			}
	}

	var curPath = new google.maps.Polyline({
		path: pathCoords,
		strokeColor: strokeColor,
		strokeOpacity: 0.9,
		strokeWeight: Math.max(1, Math.min(weight,4)),
		icons: [{icon: lineSymbol,
				 offset: '100%'}]
	});

	if(outgoing){
		mainMarker.outgoingPaths[otherMarker.id] = curPath;
	}else{
		mainMarker.incomingPaths[otherMarker.id] = curPath;
	}
	curPath.setMap(map);
}


function getAllStationIds(){
	var allStations = [];
	for (property in stationMarkers) {
		if(stationMarkers.hasOwnProperty(property)){
			allStations.push(property);
		}
	}
	return allStations
}
/*
    *    Update graph for a station being selected or not
    */
function updateStationSelected(station){

    var tempIcon = station.getIcon();
    if(station.selected)
    {
		var allStations = getAllStationIds();
        var outgoingStations = [];
        var incomingStations = [];

        //Only show up to maxNumberArrows
        //First sort descending
        var outgoingIds = getSortedIds(station.outgoing.weights, maxNumberArrows);
        for(var ind=0; ind < outgoingIds.length; ind++){
            var destMarker = stationMarkers[outgoingIds[ind]];
            outgoingStations.push(outgoingIds[ind]);
            drawPath(station, destMarker, true);
            //Redraw with correct color in case it was previously grayed out
            resetMarker(destMarker);
        }

        var incomingIds = getSortedIds(station.incoming.weights, maxNumberArrows);
        for(var ind=0; ind < incomingIds.length; ind++){
            var destMarker = stationMarkers[incomingIds[ind]];
            incomingStations.push(incomingIds[ind]);
            if(station == destMarker){
            	continue;
            }
            drawPath(station, destMarker, false);
            //Redraw with correct color in case it was previously grayed out
            resetMarker(destMarker);
        }
        var stationsToGray = _.difference(allStations, _.union(outgoingStations, incomingStations));
        for(var ind=0; ind < stationsToGray.length; ind++){
            var marker = stationMarkers[stationsToGray[ind]];
            grayStationOut(marker);
        }

        tempIcon.strokeWeight = 3;
        tempIcon.strokeColor = '#FFFFFF';
        tempIcon.fillOpacity = 0.5;
        tempIcon.fillColor = '#00FFE4';

        //InfoWindow to display information persistently when selected
		if(!('infoWindow' in station)){
			var contentString = '<div id="infoWindow">';
            contentString += station.title.replace(/\n/g, "<br/>");
            contentString += '<div id="infoWindowButton">'+'<a href="#" onClick="returnToStats()" class="viewStats">View Stats</a>'+'</div>';
            contentString += '</div>';
            var infoWindow = new google.maps.InfoWindow({
				content: contentString,
				flat: true,
				shadow: ""
			});
		station.infoWindow = infoWindow;

          /*$("#viewStats").click(function()
          {
            returnToStats();
          });*/

        var statString = genStationStatString(station);
        $("#statsDivContent").html(statString);

        }
        station.infoWindow.open(map, station);
        setTimeout(function(){redrawActivityBarGraph(station)}, 100);
        //console.log(genStationStatString(station));

        var statString = genStationStatString(station);
        $("#statsDivContent").html(statString);
  }
  else
  {
    resetMarker(station);
  }
  station.setIcon(tempIcon);
}

function resetMarker(station){
    var tempIcon = station.getIcon();
    clearStationPaths(station);
    if(station.hasOwnProperty('infoWindow')){
        station.infoWindow.close();
    }

    tempIcon.fillOpacity = defStationOpacity;
    tempIcon.fillColor = station.tripColorStr;
    station.setIcon(tempIcon);
}

//Generates a self loop, counter clockwise, northeast
function generateSelfLoop(location){
    var rad = 0.003;
	//This variable serves to instruct where the start location
	//is on the radius of the circle being plotted
	var start_theta = -3*Math.PI/4;
	var offset_lng = location.lng() - rad * Math.cos(start_theta);
	var offset_lat = location.lat() - rad * Math.sin(start_theta);
	var num_points = 32;
	var dtheta = 2*Math.PI/num_points;
	var curvePoints = [location];

	var next_lng = 0;
	var next_lat = 0;
	var cur_theta = start_theta;
	for(var ii= 1; ii < num_points; ii++){
		cur_theta += dtheta;
		next_lng = offset_lng + rad * Math.cos(cur_theta);
		next_lat = offset_lat + rad * Math.sin(cur_theta);
		curvePoints.push(new google.maps.LatLng(next_lat, next_lng, true));
	}
	curvePoints.push(location);
    return curvePoints;
}


function generateCurvedLine(start, end, radius_divisor) {

	/*
	In case anybody reads this, I want you to know
	that I know latitude and longitude are not the same as
	cartesian coordinates on a plane. However, I'm going to treat
	them that way to generate a nice pretty bezier curve. It's
	just visualization, it should be close enough at this scale.

	First we get a normal vector from source to dest. Then
	rotate it pi/2 clockwise, add that vector to the center
	coordinate, and make a curve with those three points
	*/
    var dlat = end.lat() - start.lat();
    var dlng = end.lng() - start.lng();

    var midLat = start.lat() + dlat/2;
    var midLng = start.lng() + dlng/2;

    //This isn't a typo (probably), we switch the coordinates
    //to accomplish the rotation
    var bendLat = midLat - dlng / radius_divisor;
    var bendLng = midLng + dlat / radius_divisor;
    var bendLatLng = new google.maps.LatLng(bendLat, bendLng);

    //Okay, now we have three points, and we want to curve
    //from start-center-end. Consider them Bezier control points
    var numPoints = 16;
    var delta = 1.0/numPoints;
    var curvePoints = [start];

    for (var ii=1; ii < numPoints; ii++) {
        var frac = ii*delta;
        var nextPoint = bezierLatLng(frac, start, bendLatLng, end);
        //console.log(nextPoint.lat() + "," + nextPoint.lng());
        curvePoints.push(nextPoint);
    }
    curvePoints.push(end);

    return curvePoints;
}

/**
*    Interpolate LatLng objects via bezier curve
*/
function bezierLatLng(t, p0, p1, p2){
    var lat = bezier(t, p0.lat(), p1.lat(), p2.lat());
    var lng = bezier(t, p0.lng(), p1.lng(), p2.lng());
    //Don't want to wrap
    return new google.maps.LatLng(lat, lng, true);
}
/*
*    Return a point along the bezier curve using p012 as
*    control points.
*    See http://en.wikipedia.org/wiki/Bezier_curve#Quadratic_B.C3.A9zier_curves
*    p<i> must be objects with addition defined.
*    0 <= t <= 1
*/
function bezier(t, p0, p1, p2){
    omt = 1-t;
    var ans = Math.pow(omt, 2) * p0;
    ans += 2*omt*t*p1;
    ans += Math.pow(t, 2) * p2;
    return ans;
}

function clearStationMarkers() {
    mapFunctionStations(function(station){
        station.setMap(null);
    });
    stationMarkers = {};
}

function getEmptyWeights(){
    weights = {}
    for(id in stationMarkers){
        weights[id] = 0;
    }
    return weights;
}

function resetStationStatistics(station) {
    station.incoming = {total: 0, weights: getEmptyWeights()};
    station.outgoing = {total: 0, weights: getEmptyWeights()};
    clearStationPaths(station);
    if(station.hasOwnProperty('infoWindow')){
        station.infoWindow.close();
        delete station.infoWindow;
    }
}

function clearStationPaths(station){
	station.getIcon().strokeWeight = 1;
	clearStationPaths1D(station.outgoingPaths);
	station.outgoingPaths = {};
	clearStationPaths1D(station.incomingPaths);
	station.incomingPaths = {};
}

function clearStationPaths1D(pathObj){
    for(otherId in pathObj){
        var path = pathObj[otherId];
        path.setMap(null);
        path = null;
    }
}

function grayStationOut(station){
    var tempIcon = station.getIcon();
    tempIcon.fillOpacity = 0;
    tempIcon.strokeOpacity = .4;
    station.setIcon(tempIcon);
    if(station.hasOwnProperty('infoWindow')){
        station.infoWindow.close();
    }

}

/*
*    Apply the specified function to each stationMarker.
*    Function gets one argument, the stationMarker
*/
function mapFunctionStations(func) {
    if (stationMarkers) {
        for (i in stationMarkers) {
            func(stationMarkers[i]);
        }
    }
}

/*
 * Just like mapFunctionStations,
 * except "asynchronous"
 */
function mapFunctionStationsAsync(func) {
    var newFunc = function(station){
        setTimeout(function(){func(station)}, 0);
    };
    mapFunctionStations(newFunc);
}

/**
 * Generate statistics string,
 * showing most common sources/destinations
 * for the given station_id
 */
function genStationStatString(station){
    if(!selectedIds)
    {
        var str = "<div id='statsDivContent'>An overview of any station can be found here once you have selected one. </br></div>";
        return str;
    }
   var str = "<p class='statContent_StationName'>" + station.name + "</p>";
   var timeValues = $("#myTimeSlider").slider('values');
   str += "<p class='statContent_Time'>" + "From..." + getHourMinStr(timeValues[0]) + "</br> To......." + getHourMinStr(timeValues[1]) + "</p>";

   percentIncoming = {};
   percentOutgoing = {};
   totalActivity = {};
   var stationIds = getAllStationIds();
   for(var index in stationIds){
       var id = stationIds[index];
       var incoming = station['incoming'].weights[id]/station['incoming'].total;
       var outgoing = station['outgoing'].weights[id]/station['outgoing'].total;
       percentIncoming[id] = incoming*100;
       percentOutgoing[id] = outgoing*100;

       totalActivity[id] = stationMarkers[id].incoming.total + stationMarkers[id].outgoing.total;
   }
   var maxNum = 5;
   var incomingIds = getSortedIds(percentIncoming, maxNum);
   var outgoingIds = getSortedIds(percentOutgoing, maxNum+1);
   var sortedActivity = getSortedIds(totalActivity, 50000);
   var rank = sortedActivity.indexOf(station.id) + 1;

   str += "</br>Ranked " + rank + " / " + sortedActivity.length + " in activity";

   str += "</br></br>People arriving at this station tended to come from: </br> ";
   str += getTopOtherStationString(incomingIds, percentIncoming, station, maxNum, false);

   str += "</br></br>People leaving this station tended to go to: </br>";
   str += getTopOtherStationString(outgoingIds, percentOutgoing, station, maxNum, true);
   return str;

}

/**
 * Get the top maxNum stations string showing name and fraction (from percents), skipping the stationId
 * if skipSelf is true. ids should be a descending ranked array, strings will be listed in that order
 */
function getTopOtherStationString(ids, percents, station, maxNum, skipSelf){
    var str = "";
    var count = 0;
    for (var index in ids) {
        if(count > maxNum){
            break;
        }
        var id = ids[index];
        if(id == station.id){
            if(skipSelf){
                continue;
            }
            str += "</br>This station";
        }else{
            str += "</br>" + stationMarkers[id].name;
        }

        var numStr = "("+ percents[id].toFixed(1) + "%)";
        str += " " + numStr;
        count += 1;
    }
    return str;
}

