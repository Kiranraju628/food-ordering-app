package com.foodapp.repository;

import com.foodapp.entity.DeliveryPartner;
import com.foodapp.entity.Order;
import com.foodapp.entity.Restaurant;
import com.foodapp.entity.User;
import com.foodapp.enums.Enums.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByCustomer(User customer);
    List<Order> findByRestaurant(Restaurant restaurant);
    List<Order> findByDeliveryPartner(DeliveryPartner deliveryPartner);
    List<Order> findByStatus(OrderStatus status);
}
