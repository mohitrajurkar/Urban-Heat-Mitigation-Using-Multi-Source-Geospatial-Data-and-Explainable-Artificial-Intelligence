package com.mohit.urbanheatai.repository;

import com.mohit.urbanheatai.entity.Intervention;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InterventionRepository
        extends JpaRepository<Intervention, Long> {
}