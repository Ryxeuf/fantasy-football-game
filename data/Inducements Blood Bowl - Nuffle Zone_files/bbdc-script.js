jQuery(document).ready(function($) {
    console.log('Nuffle Dice Calculator inicializado');
    
    // Verificar que jQuery está disponible
    if (typeof $ === 'undefined') {
        console.error('jQuery no está disponible');
        return;
    }
    
    // Función para verificar si un elemento existe
    function elementExists(selector) {
        const element = $(selector);
        if (element.length === 0) {
            console.warn(`Elemento no encontrado: ${selector}`);
            return false;
        }
        return true;
    }
    
    // Verificar que los elementos necesarios existen
    const requiredElements = [
        '#bbdc-calculator-form',
        '#bbdc-roll-type',
        '#bbdc-target',
        '#bbdc-reroll',
        '.bbdc-tackle-dice-selector',
        '.bbdc-tackle-btn'
    ];
    
    const missingElements = requiredElements.filter(selector => !elementExists(selector));
    if (missingElements.length > 0) {
        console.error('Elementos faltantes:', missingElements);
    }
    
    // Función para formatear probabilidades como porcentaje
    function formatProbability(prob) {
        return (prob * 100).toFixed(1) + '%';
    }

    // Función para calcular la probabilidad base para un dado
    function calculateBaseProbability(target) {
        // Para un objetivo de X+, necesitamos sacar X o más en un d6
        // Por lo tanto, la probabilidad es (7-X)/6
        return (7 - target) / 6;
    }

    // Función para calcular la probabilidad de placaje con múltiples dados
    function calculateTackleProbabilities(numDice) {
        // Probabilidades base por cara
        const probabilities = {
            pow: 1/6,      // POW (6)
            powDodge: 1/6, // POW+DODGE (5)
            push: 2/6,     // PUSH (3-4)
            bothDown: 1/6, // BOTH DOWN (2)
            skull: 1/6     // SKULL (1)
        };

        // Para múltiples dados, calculamos la probabilidad de cada resultado
        const results = {
            pow: probabilities.pow,
            powDodge: probabilities.powDodge,
            push: probabilities.push,
            bothDown: probabilities.bothDown,
            skull: probabilities.skull
        };

        // Calcular probabilidad total de éxito (POW o POW+DODGE)
        const successProb = 1 - Math.pow(1 - (probabilities.pow + probabilities.powDodge), numDice);

        return {
            faceProbs: results,
            totalProb: successProb
        };
    }

    // Función para calcular la probabilidad con reroll
    function calculateRerollProbability(prob) {
        // P(éxito) = P(éxito en primera tirada) + P(fallo en primera tirada) * P(éxito en segunda tirada)
        return prob + (1 - prob) * prob;
    }

    // Función para calcular y mostrar las probabilidades normales
    function calculateAndDisplayProbabilities() {
        console.log('Calculando probabilidades...');
        
        const rollType = $('#bbdc-roll-type').val();
        const target = parseInt($('#bbdc-target').val());
        const hasReroll = $('#bbdc-reroll').is(':checked');
        const resultsDiv = $('#bbdc-results');

        console.log('Tipo de tirada:', rollType);
        console.log('Objetivo:', target);
        console.log('Reroll:', hasReroll);

        // Si no hay tipo de tirada seleccionado, ocultar resultados y salir
        if (!rollType) {
            console.log('No hay tipo de tirada seleccionado');
            resultsDiv.hide();
            return;
        }

        // Calcular probabilidad base según el objetivo
        let baseProb = calculateBaseProbability(target);
        console.log('Probabilidad base:', baseProb);

        // Calcular probabilidad con reroll si es aplicable
        let rerollProb = hasReroll ? calculateRerollProbability(baseProb) : null;
        console.log('Probabilidad con reroll:', rerollProb);

        // Mostrar resultados
        $('#bbdc-no-reroll-prob').text(formatProbability(baseProb));
        
        if (rerollProb !== null) {
            $('#bbdc-reroll-prob').text(formatProbability(rerollProb));
        } else {
            $('#bbdc-reroll-prob').text('-');
        }

        resultsDiv.show();
        console.log('Resultados mostrados');
    }

    // Función para calcular y mostrar las probabilidades de placaje
    function calculateAndDisplayTackleProbabilities(numDice) {
        console.log('Calculando probabilidades de placaje para', numDice, 'dados');
        
        const results = calculateTackleProbabilities(numDice);
        const tackleResults = $('.bbdc-tackle-results');

        // Mostrar probabilidades por cara
        $('#pow-prob').text(formatProbability(results.faceProbs.pow));
        $('#pow-dodge-prob').text(formatProbability(results.faceProbs.powDodge));
        $('#push-prob').text(formatProbability(results.faceProbs.push));
        $('#both-down-prob').text(formatProbability(results.faceProbs.bothDown));
        $('#skull-prob').text(formatProbability(results.faceProbs.skull));

        // Mostrar probabilidad total de éxito
        $('#bbdc-tackle-total-prob').text(formatProbability(results.totalProb));

        tackleResults.show();
        console.log('Resultados de placaje mostrados');
    }

    // Manejar eventos de los botones de placaje
    if (elementExists('.bbdc-tackle-dice-selector')) {
        console.log('Vinculando eventos a los botones de placaje');
        
        // Usar delegación de eventos para manejar los clics en los botones
        $('.bbdc-tackle-dice-selector').on('click', '.bbdc-tackle-btn', function(e) {
            e.preventDefault();
            console.log('Botón de placaje clickeado');
            
            try {
                const numDice = parseInt($(this).data('dice'));
                if (isNaN(numDice)) {
                    throw new Error('Número de dados inválido');
                }
                
                console.log('Número de dados:', numDice);
                $('.bbdc-tackle-btn').removeClass('active');
                $(this).addClass('active');
                calculateAndDisplayTackleProbabilities(numDice);
            } catch (error) {
                console.error('Error al manejar clic en botón de placaje:', error);
            }
        });
    }
    
    // Asegurarse de que los elementos existan antes de vincular eventos
    if (elementExists('#bbdc-calculator-form')) {
        console.log('Formulario encontrado, vinculando eventos');
        
        // Vincular eventos para el calculador normal
        $('#bbdc-calculator-form').on('submit', function(e) {
            e.preventDefault();
            console.log('Formulario enviado');
            try {
                calculateAndDisplayProbabilities();
            } catch (error) {
                console.error('Error al calcular probabilidades:', error);
            }
        });

        // Calcular cuando cambie cualquier entrada
        $('#bbdc-roll-type, #bbdc-target, #bbdc-reroll').on('change', function() {
            console.log('Valor cambiado:', this.id);
            try {
                calculateAndDisplayProbabilities();
            } catch (error) {
                console.error('Error al calcular probabilidades:', error);
            }
        });

        // Calcular probabilidades iniciales si el formulario ya tiene valores
        if ($('#bbdc-roll-type').val()) {
            console.log('Valores iniciales encontrados, calculando probabilidades');
            try {
                calculateAndDisplayProbabilities();
            } catch (error) {
                console.error('Error al calcular probabilidades iniciales:', error);
            }
        }
    }
}); 