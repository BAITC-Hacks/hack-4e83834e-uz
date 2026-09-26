"""Geospatial helpers for the RoadWatch scoring pipeline.

This module is intentionally kept dependency-free (stdlib math only) so it can
be imported anywhere without pulling in GIS libraries.  At the scale of a city
road network (~hundreds of segments) the O(n) scan is fast enough; add a
spatial index only if profiling shows it to be a bottleneck.
"""

import math
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.orm import Session
    from app import models


# ---------------------------------------------------------------------------
# Haversine distance
# ---------------------------------------------------------------------------

_EARTH_RADIUS_M = 6_371_000  # mean Earth radius in metres


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return the great-circle distance in **metres** between two WGS-84
    coordinates using the haversine formula.

    The haversine is numerically stable for small distances (unlike the
    spherical law of cosines) and accurate to within ~0.5 % at city scale,
    which is more than sufficient for segment-matching purposes.
    """
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * _EARTH_RADIUS_M * math.asin(math.sqrt(a))


# ---------------------------------------------------------------------------
# Nearest-segment lookup
# ---------------------------------------------------------------------------

def find_nearest_segment(
    lat: float,
    lng: float,
    db: "Session",
    radius_m: float = 150.0,
) -> "models.RoadSegment | None":
    """Return the closest ``RoadSegment`` to **(lat, lng)** within *radius_m*
    metres, or ``None`` if no segment falls inside the radius.

    Design notes
    ------------
    * Uses a full table scan so it works with any SQLAlchemy-compatible
      database without spatial extensions.  For a city-scale network this is
      fast (< 1 ms for hundreds of rows); revisit with a proper spatial index
      if the segment count grows into the tens of thousands.
    * ``radius_m`` is configurable so callers can tighten or loosen the
      acceptance window depending on the use-case (e.g. a tighter radius for
      highly accurate GPS, a wider one for coarse network-based positions).
    * This function is intentionally **not** wired into ``submit_report()``
      yet — it is provided for a future flow where ``segment_id`` can be
      inferred automatically from a GPS coordinate rather than selected by
      the user.

    Parameters
    ----------
    lat, lng:
        WGS-84 decimal degrees of the point to match.
    db:
        Active SQLAlchemy session used to fetch segments.
    radius_m:
        Maximum acceptance distance in metres (default 150 m).

    Returns
    -------
    The nearest ``RoadSegment`` within *radius_m*, or ``None``.
    """
    # Import here to avoid a circular import at module level (models → database
    # → this module might be imported early in the startup sequence).
    from app import models  # noqa: PLC0415

    best_segment = None
    best_dist = radius_m  # anything farther is rejected

    for segment in db.query(models.RoadSegment).all():
        dist = haversine_m(lat, lng, segment.lat, segment.lng)
        if dist < best_dist:
            best_dist = dist
            best_segment = segment

    return best_segment
