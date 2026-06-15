package com.foodapp.repository;

import com.foodapp.entity.Cart;
import com.foodapp.entity.CartItem;
import com.foodapp.entity.FoodItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface CartItemRepository extends JpaRepository<CartItem, Long> {
    List<CartItem> findByCart(Cart cart);
    Optional<CartItem> findByCartAndFoodItem(Cart cart, FoodItem foodItem);
    void deleteByCart(Cart cart);
}
