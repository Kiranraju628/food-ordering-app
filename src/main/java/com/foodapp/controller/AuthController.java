package com.foodapp.controller;

import com.foodapp.config.JwtTokenProvider;
import com.foodapp.dto.AuthResponse;
import com.foodapp.dto.LoginRequest;
import com.foodapp.dto.RegisterRequest;
import com.foodapp.entity.*;
import com.foodapp.enums.Enums.RoleName;
import com.foodapp.repository.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final CartRepository cartRepository;
    private final RestaurantRepository restaurantRepository;
    private final DeliveryPartnerRepository deliveryPartnerRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;

    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        loginRequest.getUsername(),
                        loginRequest.getPassword()
                )
        );

        SecurityContextHolder.getContext().setAuthentication(authentication);
        String jwt = tokenProvider.generateToken(authentication);

        org.springframework.security.core.userdetails.User userDetails =
                (org.springframework.security.core.userdetails.User) authentication.getPrincipal();

        User user = userRepository.findByUsername(userDetails.getUsername()).orElseThrow();

        List<String> roles = userDetails.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toList());

        return ResponseEntity.ok(AuthResponse.builder()
                .token(jwt)
                .username(user.getUsername())
                .email(user.getEmail())
                .roles(roles)
                .userId(user.getId())
                .build());
    }

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@Valid @RequestBody RegisterRequest registerRequest) {
        if (userRepository.existsByUsername(registerRequest.getUsername())) {
            return ResponseEntity.badRequest().body("Username is already taken");
        }

        if (userRepository.existsByEmail(registerRequest.getEmail())) {
            return ResponseEntity.badRequest().body("Email Address already in use");
        }

        // Create user
        User user = User.builder()
                .username(registerRequest.getUsername())
                .email(registerRequest.getEmail())
                .phone(registerRequest.getPhone())
                .password(passwordEncoder.encode(registerRequest.getPassword()))
                .enabled(true)
                .build();

        Set<Role> roles = new HashSet<>();
        String requestRole = registerRequest.getRole().toUpperCase();
        RoleName roleName;

        switch (requestRole) {
            case "ADMIN":
                roleName = RoleName.ROLE_ADMIN;
                break;
            case "RESTAURANT":
                roleName = RoleName.ROLE_RESTAURANT;
                break;
            case "DELIVERY":
                roleName = RoleName.ROLE_DELIVERY;
                break;
            default:
                roleName = RoleName.ROLE_CUSTOMER;
                break;
        }

        Role userRole = roleRepository.findByName(roleName)
                .orElseThrow(() -> new RuntimeException("Error: User Role not found in database. Please seed database first."));
        roles.add(userRole);
        user.setRoles(roles);

        User savedUser = userRepository.save(user);

        // Role-Specific Profile Initialization
        if (roleName == RoleName.ROLE_CUSTOMER) {
            // Customers get a default empty shopping cart
            Cart cart = Cart.builder().user(savedUser).build();
            cartRepository.save(cart);
        } else if (roleName == RoleName.ROLE_RESTAURANT) {
            // Restaurant owners get an inactive restaurant profile that admins approve
            String rName = registerRequest.getRestaurantName() != null ? registerRequest.getRestaurantName() : savedUser.getUsername() + "'s Restaurant";
            String rDesc = registerRequest.getRestaurantDescription() != null ? registerRequest.getRestaurantDescription() : "Fresh and delicious food";
            String rAddr = registerRequest.getRestaurantAddress() != null ? registerRequest.getRestaurantAddress() : "Default Address";

            Restaurant restaurant = Restaurant.builder()
                    .owner(savedUser)
                    .name(rName)
                    .description(rDesc)
                    .address(rAddr)
                    .approved(false) // Must be approved by Admin
                    .phone(savedUser.getPhone())
                    .imageUrl("https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500")
                    .build();
            restaurantRepository.save(restaurant);
        } else if (roleName == RoleName.ROLE_DELIVERY) {
            // Delivery riders get a delivery partner record
            String vehicle = registerRequest.getVehicleNumber() != null ? registerRequest.getVehicleNumber() : "TNDEL12345";
            DeliveryPartner partner = DeliveryPartner.builder()
                    .user(savedUser)
                    .vehicleNumber(vehicle)
                    .available(true)
                    .rating(5.0)
                    .build();
            deliveryPartnerRepository.save(partner);
        }

        return ResponseEntity.ok("User registered successfully");
    }
}
