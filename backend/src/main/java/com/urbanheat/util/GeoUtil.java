package com.urbanheat.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.locationtech.jts.geom.*;

/** JTS <-> GeoJSON helpers (EPSG:4326, lon/lat axis order). */
public final class GeoUtil {
    public static final GeometryFactory FACTORY = new GeometryFactory(new PrecisionModel(), 4326);

    private GeoUtil() {
    }

    public static Point point(double lon, double lat) {
        return FACTORY.createPoint(new Coordinate(lon, lat));
    }

    public static Point point(JsonNode lonLat) {
        return point(lonLat.get(0).asDouble(), lonLat.get(1).asDouble());
    }

    /** Builds a polygon from a GeoJSON Polygon geometry node (exterior ring only). */
    public static Polygon polygon(JsonNode geometry) {
        JsonNode ring = geometry.get("coordinates").get(0);
        Coordinate[] coords = new Coordinate[ring.size()];
        for (int i = 0; i < ring.size(); i++) {
            coords[i] = new Coordinate(ring.get(i).get(0).asDouble(), ring.get(i).get(1).asDouble());
        }
        return FACTORY.createPolygon(coords);
    }

    public static Polygon bbox(double lonMin, double latMin, double lonMax, double latMax) {
        return FACTORY.createPolygon(new Coordinate[]{
                new Coordinate(lonMin, latMin), new Coordinate(lonMax, latMin), new Coordinate(lonMax, latMax),
                new Coordinate(lonMin, latMax), new Coordinate(lonMin, latMin)});
    }

    public static ObjectNode toGeoJson(Geometry g, ObjectMapper mapper) {
        ObjectNode node = mapper.createObjectNode();
        if (g instanceof Point p) {
            node.put("type", "Point");
            ArrayNode c = node.putArray("coordinates");
            c.add(round(p.getX())).add(round(p.getY()));
        } else if (g instanceof Polygon poly) {
            node.put("type", "Polygon");
            ArrayNode rings = node.putArray("coordinates");
            ArrayNode ring = rings.addArray();
            for (Coordinate c : poly.getExteriorRing().getCoordinates()) {
                ring.addArray().add(round(c.x)).add(round(c.y));
            }
        } else {
            throw new IllegalArgumentException("Unsupported geometry " + g.getGeometryType());
        }
        return node;
    }

    public static double[] lonLat(Point p) {
        return new double[]{round(p.getX()), round(p.getY())};
    }

    private static double round(double v) {
        return Math.round(v * 1e6) / 1e6;
    }
}
