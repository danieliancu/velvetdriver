CREATE TABLE IF NOT EXISTS `pricing_vehicles` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL UNIQUE,
  `label` varchar(100) NOT NULL,
  `as_directed_rate` decimal(8,2) NOT NULL,
  `tier1_rate` decimal(8,2) NOT NULL,
  `tier2_rate` decimal(8,2) NOT NULL,
  `tier3_rate` decimal(8,2) NOT NULL,
  `inner_zone_override_rate` decimal(8,2) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `pricing_settings` (
  `id` bigint(20) NOT NULL,
  `night_surcharge` decimal(8,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `surcharge_rules` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `code` varchar(50) DEFAULT NULL,
  `label` varchar(120) DEFAULT NULL,
  `amount` decimal(8,2) DEFAULT NULL,
  `applies_from` time DEFAULT NULL,
  `applies_to` time DEFAULT NULL,
  `metadata` longtext,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `zone_rings` (
  `id` tinyint NOT NULL,
  `name` varchar(30) DEFAULT NULL,
  `radius_miles` decimal(5,2) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- seed vehicle classes and rates
INSERT INTO `pricing_vehicles` (`code`, `label`, `as_directed_rate`, `tier1_rate`, `tier2_rate`, `tier3_rate`, `inner_zone_override_rate`)
VALUES
('executive', 'Executive', 40.00, 6.25, 2.50, 2.00, 6.25),
('luxury', 'Luxury', 60.00, 8.75, 3.50, 3.00, 8.75),
('mpv', 'Luxury MPV', 60.00, 20.00, 4.00, 3.50, 20.00)
ON DUPLICATE KEY UPDATE
  `as_directed_rate` = VALUES(`as_directed_rate`),
  `tier1_rate` = VALUES(`tier1_rate`),
  `tier2_rate` = VALUES(`tier2_rate`),
  `tier3_rate` = VALUES(`tier3_rate`),
  `inner_zone_override_rate` = VALUES(`inner_zone_override_rate`);

INSERT INTO `pricing_settings` (`id`, `night_surcharge`)
VALUES (1, 30.00)
ON DUPLICATE KEY UPDATE `night_surcharge` = VALUES(`night_surcharge`);

INSERT INTO `zone_rings` (`id`, `name`, `radius_miles`)
VALUES
(1, 'Zone 1', 3.00),
(2, 'Zone 2', 6.00),
(3, 'Zone 3', 9.00),
(4, 'Zone 4', 12.00)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `radius_miles` = VALUES(`radius_miles`);

-- seed surcharge rules used in booking
INSERT INTO `surcharge_rules` (`id`, `code`, `label`, `amount`)
VALUES
(1, 'AIRPORT_PICKUP', 'Airport pickup', 15.00),
(2, 'AIRPORT_DROPOFF', 'Airport drop-off', 7.00),
(3, 'CONGESTION', 'Central London (Congestion)', 15.00),
(4, 'AIRPORT_PICKUP_LUTON', 'Luton pickup', 15.00),
(5, 'AIRPORT_DROPOFF_LUTON', 'Luton drop-off', 7.00),
(6, 'AIRPORT_PICKUP_SOUTHEND', 'Southend pickup', 15.00),
(7, 'AIRPORT_DROPOFF_SOUTHEND', 'Southend drop-off', 7.00),
(8, 'AIRPORT_PICKUP_HEATHROW', 'Heathrow pickup', 15.00),
(9, 'AIRPORT_DROPOFF_HEATHROW', 'Heathrow drop-off', 7.00),
(10, 'AIRPORT_PICKUP_STANSTED', 'Stansted pickup', 15.00),
(11, 'AIRPORT_DROPOFF_STANSTED', 'Stansted drop-off', 7.00),
(12, 'AIRPORT_PICKUP_CITY', 'City pickup', 15.00),
(13, 'AIRPORT_DROPOFF_CITY', 'City drop-off', 7.00),
(14, 'AIRPORT_PICKUP_GATWICK', 'Gatwick pickup', 15.00),
(15, 'AIRPORT_DROPOFF_GATWICK', 'Gatwick drop-off', 7.00)
ON DUPLICATE KEY UPDATE
  `label` = VALUES(`label`),
  `amount` = VALUES(`amount`);
