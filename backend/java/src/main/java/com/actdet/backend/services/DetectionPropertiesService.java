package com.actdet.backend.services;

import com.actdet.backend.configurations.ApplicationPropertiesConfiguration;
import com.actdet.backend.data.entities.DetectionElement;
import com.actdet.backend.data.repositories.DetectionElementRepository;
import com.actdet.backend.services.dtos.DetectionElementDTO;
import jakarta.annotation.PostConstruct;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;

@Service
public class DetectionPropertiesService {
    private final DetectionElementRepository detectionElementRepository;
    private  final ApplicationPropertiesConfiguration applicationPropertiesConfiguration;

    @Autowired
    public DetectionPropertiesService(DetectionElementRepository detectionElementRepository, ApplicationPropertiesConfiguration applicationPropertiesConfiguration) {
        this.detectionElementRepository = detectionElementRepository;
        this.applicationPropertiesConfiguration = applicationPropertiesConfiguration;
    }

    @PostConstruct
    @Transactional
    public void setUpDetectedElements(){
        Set<String> existingElementNames = detectionElementRepository.findAllNames();

        List<String> missingElementNames = applicationPropertiesConfiguration.getDetectedElementsNames().stream()
                .filter(e -> !existingElementNames.contains(e)).toList();


        this.detectionElementRepository.saveAll(missingElementNames.stream()
                .map(DetectionElement::new).toList());
    }


    public List<DetectionElementDTO> getSupportedDetectionElements(){
        final List<DetectionElement> elements = this.detectionElementRepository.findAll();
        return elements.stream().map(DetectionElementDTO::new).toList();
    }

}
