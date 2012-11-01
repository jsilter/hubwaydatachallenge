#!/usr/bin/python

description = """Take census shape file and output only columns of interest; tract #, population, boundary points. The boundary points are in KML format"""

"""
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
"""

__author__ = "Jacob Silterra"

import argparse
import random


import shapefile


parser = argparse.ArgumentParser(description=description)
parser.add_argument('--fraction', dest='fraction', default=1.1,
help='Fraction (0..1.0) of shapes to output')
parser.add_argument('--boston', dest='boston', action='store_true', help="Keep values in the boston area only. Approximate")

"""
See https://developers.google.com/kml/documentation/kmlreference#polygon
for details. We assume many of those fields are optional, based on downloaded
KML file
"""
rep_token = "replaceme"
polygon_template = "<Polygon><outerBoundaryIs><LinearRing>"
polygon_template += "<coordinates>%s</coordinates>" % (rep_token)
polygon_template += "</LinearRing></outerBoundaryIs></Polygon></Placemark>"

def create_kml_polygon(points):
    """points should be an iterable of points in longitude, latitude format"""

    #Coords are space-separated
    out_coords = " ".join(["%s,%s" % (point[0], point[1]) for point in points])
    out_str = polygon_template.replace(rep_token, out_coords)
    return out_str

if __name__ == "__main__":
    args = parser.parse_args()
    fraction = float(args.fraction)

    min_lat = -100
    max_lat = 100
    min_lng = -200
    max_lng = 200

    if args.boston:
        min_lng = -71.250
        max_lng = -70.950
        min_lat = 42.290
        max_lat = 42.400

    def check_in_bounds(point):
        """point should be 2-item lng,lat"""
        isin = point[0] >= min_lng and point[0] <= max_lng
        isin &= point[1] >= min_lat and point[1] <= max_lat
        return isin
    
    file_path = "tabblock2010_25_pophu/tabblock2010_25_pophu.shp"
    r = shapefile.Reader(file_path)
    sr = r.shapeRecords()

    #See http://www.census.gov/geo/www/tiger/tgrgit shp2010/pophu.html
    #for fields
    #Number of housing units column
    tract_col = 2 #Maybe should use 15-digit, but eh, just doing one state here
    housing_col = 6
    #Population
    pop_col = 7
    delim = ";"

    columns = ['TRACTCE10', 'POP10', 'border_points']
    print delim.join(columns)
    #points are in lng,lat order
    for census_tract in sr:
        if random.random() >= fraction:
            continue
        
        record = census_tract.record
        shape = census_tract.shape
        tract_in_bounds = any(map(check_in_bounds, shape.points))
        
        if not tract_in_bounds:
            continue
        
        point_str = create_kml_polygon(shape.points)
        line_arr = [record[tract_col], record[pop_col], point_str]
        line = delim.join(["%s" % (x) for x in line_arr])
        print line

        
        
        

    
