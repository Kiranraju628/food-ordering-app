package com.foodapp.config;

import com.foodapp.entity.*;
import com.foodapp.enums.Enums.RoleName;
import com.foodapp.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class DatabaseSeeder implements CommandLineRunner {

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final CouponRepository couponRepository;
    private final RestaurantRepository restaurantRepository;
    private final FoodItemRepository foodItemRepository;
    private final DeliveryPartnerRepository deliveryPartnerRepository;
    private final CartRepository cartRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        // 1. Seed Roles
        if (roleRepository.count() == 0) {
            roleRepository.save(Role.builder().name(RoleName.ROLE_CUSTOMER).build());
            roleRepository.save(Role.builder().name(RoleName.ROLE_ADMIN).build());
            roleRepository.save(Role.builder().name(RoleName.ROLE_RESTAURANT).build());
            roleRepository.save(Role.builder().name(RoleName.ROLE_DELIVERY).build());
        }

        Role customerRole = roleRepository.findByName(RoleName.ROLE_CUSTOMER).orElseThrow();
        Role adminRole = roleRepository.findByName(RoleName.ROLE_ADMIN).orElseThrow();
        Role restaurantRole = roleRepository.findByName(RoleName.ROLE_RESTAURANT).orElseThrow();
        Role deliveryRole = roleRepository.findByName(RoleName.ROLE_DELIVERY).orElseThrow();

        // 2. Seed Default Admin User
        if (userRepository.findByUsername("admin").isEmpty()) {
            User admin = User.builder()
                    .username("admin")
                    .email("admin@foodapp.com")
                    .phone("9999999999")
                    .password(passwordEncoder.encode("adminpassword"))
                    .enabled(true)
                    .roles(new HashSet<>(Set.of(adminRole)))
                    .build();
            userRepository.save(admin);
        }

        // 3. Seed Default Customer User
        User customer = null;
        if (userRepository.findByUsername("customer").isEmpty()) {
            customer = User.builder()
                    .username("customer")
                    .email("customer@foodapp.com")
                    .phone("8888888888")
                    .password(passwordEncoder.encode("customerpassword"))
                    .enabled(true)
                    .roles(new HashSet<>(Set.of(customerRole)))
                    .build();
            customer = userRepository.save(customer);
            cartRepository.save(Cart.builder().user(customer).build());
        }

        // 4. Seed Default Restaurant Owner and Restaurant
        User owner = null;
        Restaurant restaurant = null;
        if (userRepository.findByUsername("owner").isEmpty()) {
            owner = User.builder()
                    .username("owner")
                    .email("owner@foodapp.com")
                    .phone("7777777777")
                    .password(passwordEncoder.encode("ownerpassword"))
                    .enabled(true)
                    .roles(new HashSet<>(Set.of(restaurantRole)))
                    .build();
            owner = userRepository.save(owner);

            restaurant = Restaurant.builder()
                    .owner(owner)
                    .name("The Gourmet Kitchen")
                    .description("Authentic fine dining experience with a modern twist.")
                    .address("102, Park Street, Kolkata, West Bengal")
                    .phone("7777777777")
                    .approved(true) // Automatically approved for demonstration
                    .imageUrl("https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500")
                    .build();
            restaurant = restaurantRepository.save(restaurant);
        } else {
            restaurant = restaurantRepository.findAll().stream().findFirst().orElse(null);
        }

        // 5. Seed Default Delivery Partner
        if (userRepository.findByUsername("rider").isEmpty()) {
            User rider = User.builder()
                    .username("rider")
                    .email("rider@foodapp.com")
                    .phone("6666666666")
                    .password(passwordEncoder.encode("riderpassword"))
                    .enabled(true)
                    .roles(new HashSet<>(Set.of(deliveryRole)))
                    .build();
            rider = userRepository.save(rider);

            DeliveryPartner partner = DeliveryPartner.builder()
                    .user(rider)
                    .vehicleNumber("WB-02-AK-9876")
                    .available(true)
                    .rating(4.8)
                    .build();
            deliveryPartnerRepository.save(partner);
        }

        // 6. Seed Categories
        if (categoryRepository.count() == 0) {
            categoryRepository.save(Category.builder().name("Starters").description("Appetizing starters to kickstart your meal").build());
            categoryRepository.save(Category.builder().name("Main Course").description("Satisfying main dishes prepared to perfection").build());
            categoryRepository.save(Category.builder().name("Desserts").description("Sweet treats for your sweet tooth").build());
            categoryRepository.save(Category.builder().name("Beverages").description("Chilled and hot refreshing drinks").build());
        }

        Category starters = categoryRepository.findByName("Starters").orElseThrow();
        Category mainCourse = categoryRepository.findByName("Main Course").orElseThrow();
        Category desserts = categoryRepository.findByName("Desserts").orElseThrow();
        Category beverages = categoryRepository.findByName("Beverages").orElseThrow();

        // 7. Seed Food Items for Default Restaurant
        if (foodItemRepository.count() == 0 && restaurant != null) {
            foodItemRepository.save(FoodItem.builder()
                    .restaurant(restaurant)
                    .category(starters)
                    .name("Crispy Spring Rolls")
                    .description("Delightful crispy rolls filled with seasonal vegetables and glass noodles.")
                    .price(150.0)
                    .available(true)
                    .imageUrl("https://images.unsplash.com/photo-1544025162-d76694265947?w=500")
                    .build());

            foodItemRepository.save(FoodItem.builder()
                    .restaurant(restaurant)
                    .category(starters)
                    .name("Paneer Tikka")
                    .description("Cottage cheese cubes marinated in spices and grilled in clay oven.")
                    .price(220.0)
                    .available(true)
                    .imageUrl("https://images.unsplash.com/photo-1567188040759-fb8a883db6d8?w=500")
                    .build());

            foodItemRepository.save(FoodItem.builder()
                    .restaurant(restaurant)
                    .category(mainCourse)
                    .name("Butter Chicken with Naan")
                    .description("Tender chicken cooked in rich, buttery tomato gravy served with hot tandoori naan.")
                    .price(350.0)
                    .available(true)
                    .imageUrl("https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=500")
                    .build());

            foodItemRepository.save(FoodItem.builder()
                    .restaurant(restaurant)
                    .category(mainCourse)
                    .name("Dal Makhani")
                    .description("Slow-cooked black lentils in creamy butter sauce, a Punjabi classic.")
                    .price(260.0)
                    .available(true)
                    .imageUrl("https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500")
                    .build());

            foodItemRepository.save(FoodItem.builder()
                    .restaurant(restaurant)
                    .category(desserts)
                    .name("Hot Gulab Jamun")
                    .description("Golden fried milk-solid balls dipped in saffron sugar syrup.")
                    .price(80.0)
                    .available(true)
                    .imageUrl("https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500")
                    .build());

            foodItemRepository.save(FoodItem.builder()
                    .restaurant(restaurant)
                    .category(beverages)
                    .name("Masala Chai")
                    .description("Classic Indian spiced milk tea infused with cardamom and ginger.")
                    .price(50.0)
                    .available(true)
                    .imageUrl("https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500")
                    .build());
        }

        // 8. Seed Coupons
        if (couponRepository.count() == 0) {
            couponRepository.save(Coupon.builder()
                    .code("WELCOME50")
                    .discountPercentage(50.0)
                    .maxDiscount(100.0)
                    .expiryDate(LocalDateTime.now().plusYears(1))
                    .active(true)
                    .build());

            couponRepository.save(Coupon.builder()
                    .code("SUPERDISCOUNT")
                    .discountPercentage(20.0)
                    .maxDiscount(250.0)
                    .expiryDate(LocalDateTime.now().plusYears(1))
                    .active(true)
                    .build());
        }
    }
}
