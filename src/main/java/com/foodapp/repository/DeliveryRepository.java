package com.foodapp.repository;

import com.foodapp.entity.Delivery;
import com.foodapp.entity.DeliveryPartner;
import com.foodapp.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface DeliveryRepository extends JpaRepository<Delivery, Long> {
    Optional<Delivery> findByOrder(Order order);
    List<Delivery> findByDeliveryPartner(DeliveryPartner partner);
}
