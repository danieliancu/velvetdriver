CREATE TABLE IF NOT EXISTS `app_settings` (
  `id` bigint(20) NOT NULL,
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`payload`)),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `app_settings` (`id`, `payload`)
VALUES
(1, JSON_OBJECT(
  'asDirected', JSON_OBJECT(
    'executive', '40',
    'luxury', '60'
  ),
  'nightSurcharge', '30',
  'mileage', JSON_OBJECT(
    'executive', JSON_OBJECT('tier1', '6.25', 'tier2', '2.5', 'tier3', '2'),
    'luxury', JSON_OBJECT('tier1', '8.75', 'tier2', '3.5', 'tier3', '3'),
    'mpv', JSON_OBJECT('tier1', '10', 'tier2', '4', 'tier3', '3.5')
  ),
  'innerZoneOverride', JSON_OBJECT(
    'executive', '6.25',
    'luxury', '8.75',
    'mpv', '10'
  ),
  'surcharges', JSON_OBJECT(
    'airportPickup', '15',
    'airportDropoff', '7',
    'congestion', '15'
  )
))
ON DUPLICATE KEY UPDATE
  `payload` = VALUES(`payload`);
