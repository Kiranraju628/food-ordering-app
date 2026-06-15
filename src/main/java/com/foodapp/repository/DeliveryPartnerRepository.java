package com.foodapp.repository;

import com.foodapp.entity.DeliveryPartner;
import com.foodapp.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface DeliveryPartnerRepository extends JpaRepository<DeliveryPartner, Long> {
    Optional<DeliveryPartner> findByUser(User user);
    List<DeliveryPartner> findByAvailable(boolean available);
}
