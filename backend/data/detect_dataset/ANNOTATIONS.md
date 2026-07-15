# Hand-labeled bounding boxes for the tiny fine-tuning set

Every box below was drawn manually by visual inspection of the source image (see /backend/data/sample_images/SOURCES.md for image provenance/licenses). This is a proof-of-concept annotation set (13 images, 15 boxes across 2 of the 4 defect classes) meant to demonstrate the fine-tuning pipeline works end-to-end, not to produce a production-accurate detector. See /model/README.md for details and honest limitations.

| Image | Split | Class | x1 | y1 | x2 | y2 |
|---|---|---|---|---|---|---|
| potholes_in_bengaluru_road.jpg | val | pothole | 330 | 650 | 960 | 880 |
| portlandroadrut.jpg | train | pothole | 420 | 430 | 690 | 530 |
| otro_bache.jpg | train | pothole | 270 | 250 | 990 | 730 |
| muchos_baches_inundados.jpg | train | pothole | 560 | 430 | 900 | 760 |
| muchos_baches_inundados.jpg | train | pothole | 290 | 580 | 580 | 790 |
| lfds_1.jpg | val | pothole | 180 | 330 | 620 | 820 |
| medio_rota.jpg | train | crack | 60 | 580 | 980 | 950 |
| lcb_1.jpg | train | crack | 120 | 260 | 1040 | 730 |
| a_cracking_road_there_geograph_org_uk_14.jpg | train | crack | 110 | 90 | 340 | 640 |
| crack_along_the_road_at_uranohama_port.jpg | train | crack | 0 | 520 | 1280 | 1880 |
| cracks_in_the_road_shoulder_komunews.jpg | train | crack | 250 | 380 | 1280 | 887 |
| cracks_in_the_surface_geograph_org_uk_47.jpg | val | crack | 0 | 230 | 460 | 427 |
| deteriorated_asphalt.jpg | train | crack | 0 | 0 | 1280 | 1150 |
| damage_to_road_beside_the_avon_river_fro.jpg | val | crack | 0 | 330 | 1280 | 1707 |
