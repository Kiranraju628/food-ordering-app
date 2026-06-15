package com.foodapp.repository;

import com.foodapp.entity.Restaurant;
import com.foodapp.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface RestaurantRepository extends JpaRepository<Restaurant, Long> {
    List<Restaurant> findByApproved(boolean approved);
    Optional<Restaurant> findByOwner(User owner);
}
