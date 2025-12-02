INSERT INTO `users` (`id`, `role`, `name`, `email`, `phone`, `password_hash`, `status`)
VALUES
(1, 'client', 'John Doe', 'john.doe@example.com', '+44 7700 900123', '$2a$10$YCQRX.fuGQP7QciHAE1mCeAXz5gufpVJ6bN5JweypOlnEGW68AY/.', 'active')
ON DUPLICATE KEY UPDATE
  `role` = VALUES(`role`),
  `name` = VALUES(`name`),
  `phone` = VALUES(`phone`),
  `password_hash` = VALUES(`password_hash`),
  `status` = VALUES(`status`);

CREATE TABLE IF NOT EXISTS `client_journeys` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `client_id` bigint(20) DEFAULT NULL,
  `journey_date` datetime NOT NULL,
  `pickup` varchar(255) NOT NULL,
  `destination` text NOT NULL,
  `service_type` enum('Transfer','Wait and Return','As Directed') NOT NULL DEFAULT 'Transfer',
  `driver_name` varchar(150) NOT NULL,
  `car` varchar(150) NOT NULL,
  `plate` varchar(40) NOT NULL,
  `status` enum('Completed','Upcoming','Cancelled') NOT NULL DEFAULT 'Upcoming',
  `price` decimal(10,2) NOT NULL,
  `invoice_url` varchar(255) DEFAULT NULL,
  `passenger_name` varchar(150) NOT NULL,
  `passenger_email` varchar(255) NOT NULL,
  `passenger_phone` varchar(50) NOT NULL,
  `booking_payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`booking_payload`)),
  PRIMARY KEY (`id`),
  KEY `client_idx` (`client_id`),
  CONSTRAINT `client_journeys_user_fk` FOREIGN KEY (`client_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `client_complaints` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `client_id` bigint(20) NOT NULL,
  `journey_id` bigint(20) NOT NULL,
  `subject` varchar(200) NOT NULL,
  `details` text NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `complaint_client_idx` (`client_id`),
  KEY `complaint_journey_idx` (`journey_id`),
  CONSTRAINT `complaint_client_fk` FOREIGN KEY (`client_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `complaint_journey_fk` FOREIGN KEY (`journey_id`) REFERENCES `client_journeys` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `client_reviews` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `client_id` bigint(20) NOT NULL,
  `journey_id` bigint(20) NOT NULL,
  `rating` tinyint(1) NOT NULL,
  `review` text NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `review_client_idx` (`client_id`),
  KEY `review_journey_idx` (`journey_id`),
  CONSTRAINT `review_client_fk` FOREIGN KEY (`client_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `review_journey_fk` FOREIGN KEY (`journey_id`) REFERENCES `client_journeys` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `client_lost_property` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `client_id` bigint(20) NOT NULL,
  `journey_id` bigint(20) NOT NULL,
  `item_description` varchar(255) NOT NULL,
  `details` text NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `lost_client_idx` (`client_id`),
  KEY `lost_journey_idx` (`journey_id`),
  CONSTRAINT `lost_client_fk` FOREIGN KEY (`client_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lost_journey_fk` FOREIGN KEY (`journey_id`) REFERENCES `client_journeys` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `client_saved_quotes` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `client_id` bigint(20) NOT NULL,
  `label` varchar(255) DEFAULT NULL,
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`payload`)),
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `quote_client_idx` (`client_id`),
  CONSTRAINT `quote_client_fk` FOREIGN KEY (`client_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `client_journeys` (`client_id`, `journey_date`, `pickup`, `destination`, `service_type`, `driver_name`, `car`, `plate`, `status`, `price`, `invoice_url`, `passenger_name`, `passenger_email`, `passenger_phone`, `booking_payload`)
VALUES
(1, '2025-01-15 14:30:00', 'Heathrow T5', 'The Savoy, London', 'Transfer', 'James P.', 'Mercedes S-Class', 'DL123ABC', 'Completed', 150.00, '/invoices/INV-1501.pdf', 'John Doe', 'john.doe@example.com', '+44 7700 900123', NULL),
(1, '2025-02-01 09:00:00', 'Canary Wharf', 'The Shard', 'As Directed', 'Robert K.', 'BMW 7 Series', 'RX70DVE', 'Upcoming', 95.00, NULL, 'John Doe', 'john.doe@example.com', '+44 7700 900123', NULL),
(1, '2025-01-03 18:00:00', 'The Ned', 'Gatwick South', 'Wait and Return', 'Anna B.', 'Audi A8', 'AB21LUX', 'Completed', 120.00, '/invoices/INV-1488.pdf', 'John Doe', 'john.doe@example.com', '+44 7700 900123', NULL)
ON DUPLICATE KEY UPDATE
  `journey_date` = VALUES(`journey_date`),
  `pickup` = VALUES(`pickup`),
  `destination` = VALUES(`destination`),
  `service_type` = VALUES(`service_type`),
  `driver_name` = VALUES(`driver_name`),
  `car` = VALUES(`car`),
  `plate` = VALUES(`plate`),
  `status` = VALUES(`status`),
  `price` = VALUES(`price`),
  `invoice_url` = VALUES(`invoice_url`),
  `passenger_name` = VALUES(`passenger_name`),
  `passenger_email` = VALUES(`passenger_email`),
  `passenger_phone` = VALUES(`passenger_phone`),
  `booking_payload` = VALUES(`booking_payload`);
