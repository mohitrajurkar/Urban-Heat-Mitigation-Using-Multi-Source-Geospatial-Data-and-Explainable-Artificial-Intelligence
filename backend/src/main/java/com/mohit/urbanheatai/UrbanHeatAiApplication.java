package com.mohit.urbanheatai;

import com.mohit.urbanheatai.config.AppProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(AppProperties.class)
public class UrbanHeatAiApplication {

	public static void main(String[] args) {
		SpringApplication.run(UrbanHeatAiApplication.class, args);
	}

}
