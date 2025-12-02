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

-- seed surcharge rules used in booking
INSERT INTO `surcharge_rules` (`id`, `code`, `label`, `amount`)
VALUES
(1, 'AIRPORT_PICKUP', 'Airport pickup', 15.00),
(2, 'AIRPORT_DROPOFF', 'Airport drop-off', 7.00),
(3, 'CONGESTION', 'Central London (Congestion)', 15.00)
ON DUPLICATE KEY UPDATE
  `label` = VALUES(`label`),
  `amount` = VALUES(`amount`);
