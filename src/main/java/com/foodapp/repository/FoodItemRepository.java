package com.foodapp.repository;

import com.foodapp.entity.Category;
import com.foodapp.entity.FoodItem;
import com.foodapp.entity.Restaurant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface FoodItemRepository extends JpaRepository<FoodItem, Long> {
    List<FoodItem> findByRestaurant(Restaurant restaurant);
    List<FoodItem> findByRestaurantAndAvailable(Restaurant restaurant, boolean available);
    List<FoodItem> findByRestaurantAndCategory(Restaurant restaurant, Category category);
    List<FoodItem> findByNameContainingIgnoreCase(String name);
}
