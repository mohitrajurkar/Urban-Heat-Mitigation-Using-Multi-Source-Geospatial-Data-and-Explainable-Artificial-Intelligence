package com.mohit.urbanheatai.repository;

import com.mohit.urbanheatai.entity.HeatArea;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HeatRepository extends JpaRepository<HeatArea, Long> {

}