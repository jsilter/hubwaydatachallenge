## Description

This is the source code behind our entry for the [Hubway data challenge](http://hubwaydatachallenge.org) for details. You can see a running entry at http://www.jacobsilterra.com/hubway-data-challenge/,
and a description 

## Installation

keys.js must be altered to include your browser API key from google. Needless to say, this key must have permissions to run on your domain. See https://code.google.com/apis/console/

Only the files in the main directory need to be available, they should all 
be in the same directory on a server. I've included the scripts used for pre-processing data, 
those are only useful if you plan on parsing the Hubway data yourself. That means everything under the "preprocessing_scripts" directory.

## Data Sources

This application queries data from Google Fusion tables which I have made publicly available. This data may be taken down at any time. It is strongly suggested you re-host the data yourself and change the relevant table IDs. The python scripts assume that the csv files from Hubway are in the same directory (with default names), and print the relevant data to stdout. It's roughly the same as the input data, just with dates separated into components (because of the nature of our queries) and time zone converted to Boston. 

The population overlay comes from 2010 census data. For performance reasons only the Boston area data exists in the table. It was extracted and converted to KML format with parse_gis_shp.py; data downloaded from http://www2.census.gov/geo/tiger/TIGER2010BLKPOPHU/. 

## Acknowledgements

Data is plotted using the Google Maps API, and retrieved using the Google Fusion API. The site also uses jQuery, jQuery-UI, and the jQuery-URL-Parser (included). 

## License

Copyright (c) 2012, Jacob Silterra and Monica Gallegos
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



