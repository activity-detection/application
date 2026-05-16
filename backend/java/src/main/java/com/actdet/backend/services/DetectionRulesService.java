package com.actdet.backend.services;

import com.actdet.backend.data.entities.DetectionElement;
import com.actdet.backend.data.entities.DetectionRule;
import com.actdet.backend.data.entities.DetectionTemplate;
import com.actdet.backend.data.entities.DetectionVector;
import com.actdet.backend.data.repositories.DetectionElementRepository;
import com.actdet.backend.data.repositories.DetectionTemplateRepository;
import com.actdet.backend.services.dtos.DetectionRuleDTO;
import com.actdet.backend.services.dtos.DetectionTemplateDTO;
import com.actdet.backend.services.dtos.DetectionVectorDTO;
import com.actdet.backend.services.exceptions.RecordNotFoundException;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.util.Pair;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class DetectionRulesService {

    private DetectionTemplateRepository detectionTemplateRepository;
    private DetectionElementRepository detectionElementRepository;

    @Autowired
    public DetectionRulesService(DetectionTemplateRepository detectionTemplateRepository, DetectionElementRepository detectionElementRepository) {
        this.detectionTemplateRepository = detectionTemplateRepository;
        this.detectionElementRepository = detectionElementRepository;
    }

    public List<DetectionTemplateDTO> getAllDetectionTemplates() {
        return this.detectionTemplateRepository.findAll().stream()
                .map(DetectionTemplateDTO::from).toList();
    }

    public Page<DetectionTemplateDTO> getAllDetectionRules(final Pageable pageable) {
        final Page<DetectionTemplate> rules = this.detectionTemplateRepository.findAll(pageable);
        return new PageImpl<>(rules.get().map(DetectionTemplateDTO::from).toList(), pageable, rules.getTotalElements());
    }

    @Transactional
    public void addNewDetectionTemplate(String templateName, List<DetectionVectorDTO> detectionVectors) {
        DetectionTemplate template = new DetectionTemplate(templateName, new ArrayList<>());

        Map<String, DetectionElement> elementsByName = getDetectionElementsMap(detectionVectors);

        for (DetectionVectorDTO dto : detectionVectors) {
            DetectionVector vector = new DetectionVector();
            vector.setTemplate(template);
            List<DetectionRule> rules = new ArrayList<>();
            dto.getRules().forEach(ruleDto -> {
                var rule = new DetectionRule();
                rule.setElement(elementsByName.get(ruleDto.getElementName()));
                rule.setVector(vector);
                if (ruleDto.isRange()) {
                    rule.setCountFrom(ruleDto.getCountFrom());
                    rule.setCountTo(ruleDto.getCountTo());
                } else {
                    rule.setCount(ruleDto.getCount());
                }
                rules.add(rule);
            });
            vector.setRules(rules);
            template.getDetectionVectors().add(vector);
        }

        detectionTemplateRepository.save(template);
    }

    @Transactional
    public void deleteDetectionTemplate(String templateName) {
        DetectionTemplate template = detectionTemplateRepository.findByName(templateName)
                .orElseThrow(() -> new RecordNotFoundException("Specified rule does not exist"));
        detectionTemplateRepository.delete(template);
    }

    @Transactional
    public void editDetectionTemplate(String templateName, List<DetectionVectorDTO> newOrEditedDetectionVectors) {
        editDetectionTemplate(templateName, templateName, newOrEditedDetectionVectors);
    }

    @Transactional
    public void editDetectionTemplate(String oldRuleName, String newRuleName, List<DetectionVectorDTO> detectionVectors) {
        DetectionTemplate template = detectionTemplateRepository.findByName(oldRuleName)
                .orElseThrow(() -> new RecordNotFoundException("Specified rule does not exist"));
        template.setName(newRuleName);

        var elementsByName = getDetectionElementsMap(detectionVectors);
        var vIds = detectionVectors.stream().map(DetectionVectorDTO::getVectorId).collect(Collectors.toSet());
        Map<Integer, DetectionVector> vectorsInUseMap = template.getDetectionVectors().stream()
                .filter(v -> vIds.contains(v.getId()))
                .collect(Collectors.toMap(DetectionVector::getId, v -> v));

        List<DetectionVectorDTO> editedVectors = new ArrayList<>();
        List<DetectionVectorDTO> newVectors = new ArrayList<>();

        detectionVectors.forEach(dto -> {
            if(vectorsInUseMap.containsKey(dto.getVectorId())) editedVectors.add(dto);
            else newVectors.add(dto);
        });


        editedVectors.forEach(dto -> {
            var rules = vectorsInUseMap.get(dto.getVectorId()).getRules();
            var em = dto.getRules().stream().map(DetectionRuleDTO::getElementName).collect(Collectors.toSet());
            Map<String, DetectionRule> rulesInUse = rules.stream()
                    .filter(r -> em.contains(r.getElementName()))
                    .collect(Collectors.toMap(DetectionRule::getElementName, v -> v));

            List<DetectionRuleDTO> editedRules = new ArrayList<>();
            List<DetectionRuleDTO> newRules = new ArrayList<>();

            dto.getRules().forEach(ruleDTO -> {
                if(rulesInUse.containsKey(ruleDTO.getElementName())) editedRules.add(ruleDTO);
                else newRules.add(ruleDTO);
            });

            editedRules.forEach(ruleDTO -> {
                if(ruleDTO.isRange()){
                    rulesInUse.get(ruleDTO.getElementName()).setCountFrom(ruleDTO.getCountFrom());
                    rulesInUse.get(ruleDTO.getElementName()).setCountTo(ruleDTO.getCountTo());
                }else{
                    rulesInUse.get(ruleDTO.getElementName()).setCount(ruleDTO.getCount());
                }
            });
        });

        List<DetectionVector> resultVectors = new ArrayList<>(vectorsInUseMap.values().stream().toList());

        newVectors.forEach(dto -> {
            DetectionVector newVector = new DetectionVector();
            newVector.setTemplate(template);
            newVector.setRules(dto.getRules().stream().map(ruleDTO -> {
                var detectionRule = new DetectionRule();
                detectionRule.setVector(newVector);
                detectionRule.setElement(elementsByName.get(ruleDTO.getElementName()));
                if(ruleDTO.isRange()){
                    detectionRule.setCountFrom(ruleDTO.getCountFrom());
                    detectionRule.setCountTo(ruleDTO.getCountTo());
                }else{
                    detectionRule.setCount(ruleDTO.getCount());
                }

                return detectionRule;
            }).toList());
            resultVectors.add(newVector);
        });
        template.getDetectionVectors().clear();
        template.getDetectionVectors().addAll(resultVectors);
        detectionTemplateRepository.save(template);
    }

    private Map<String, DetectionElement> getDetectionElementsMap(List<DetectionVectorDTO> vectorDTOS) {
        Set<String> elementNames = vectorDTOS.stream().flatMap(v -> v.getRules().stream())
                .map(DetectionRuleDTO::getElementName)
                .collect(Collectors.toSet());
        return createDetectionElementMap(elementNames);
    }

    private Map<String, DetectionElement> getDetectionElementsMap(DetectionVectorDTO vectorDTO) {
        Set<String> elementNames = vectorDTO.getRules().stream()
                .map(DetectionRuleDTO::getElementName)
                .collect(Collectors.toSet());
        return createDetectionElementMap(elementNames);

    }


    private Map<String, DetectionElement> createDetectionElementMap(Set<String> elementNames) {
        Map<String, DetectionElement> elementMap = detectionElementRepository.findByNameIn(elementNames).stream()
                .collect(Collectors.toMap(DetectionElement::getName, element -> element));
        List<String> missingElementNames = elementNames.stream()
                .filter(name -> !elementMap.containsKey(name))
                .toList();
        if (!missingElementNames.isEmpty()) {
            throw new RecordNotFoundException("Specified detection elements are not supported: "+missingElementNames.toString());
        }

        return elementMap;
    }


}
