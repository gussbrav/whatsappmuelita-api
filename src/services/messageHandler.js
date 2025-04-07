import whatsappService from './whatsappService.js';
import appendToSheet from './googleSheetsService.js';
import openAiService from './openAiService.js'
import { DateTime } from 'luxon';

class MessageHandler {
  constructor() {
    this.appointmentState = {};
    this.assistandState = [];
  }

  async handleIncomingMessage(message, senderInfo) {
    if (message?.type === 'text') {
      const incomingMessage = message.text.body.toLowerCase().trim();

      if(this.isGreeting(incomingMessage)){
        await this.sendWelcomeMessage(message.from, message.id, senderInfo);
        await this.sendWelcomeMenu(message.from);
      } else if(incomingMessage === 'media') {
        await this.sendMedia(message.from);
      } else if (this.appointmentState[message.from]) {
        await this.handleAppointmentFlow(message.from, incomingMessage);
      } else if (this.assistandState[message.from]) {
        await this.handleAssistandFlow(message.from, incomingMessage);
      } else {
        await this.handleMenuOption(message.from, incomingMessage);
      }
      await whatsappService.markAsRead(message.id);
    } else if (message?.type === 'interactive') {
      const option = message?.interactive?.button_reply?.id;
      await this.handleMenuOption(message.from, option);
      await whatsappService.markAsRead(message.id);
    }
  }

  isGreeting(message){
    const greetings = ["hola", "hello", "hi", "buenas tardes"];
    return greetings.includes(message);
  }

  getSenderName(senderInfo) {
    return senderInfo.profile?.name || senderInfo.wa_id;
  }

  async sendWelcomeMessage(to, messageId, senderInfo){
    const name = this.getSenderName(senderInfo);
    const firstName = name.split(' ')[0];    
    const formatName = firstName.replace(/[^a-zA-Z\s]/g, ''); 
    const welcomeMessage = `Hola ${formatName}, Bienvenido a nuestro Servicio Odontológico Muelita online.¿En que puedo ayudarte hoy?`;
    await whatsappService.sendMessage(to, welcomeMessage, messageId)
  }

  async sendWelcomeMenu(to) {
    const menuMessage = "Elige una Opción"
    const buttons = [
      {
        type: 'reply', reply: { id: 'option_1', title: 'Agendar' }
      },
      {
        type: 'reply', reply: { id: 'option_2', title: 'Consultar'}
      },
      {
        type: 'reply', reply: { id: 'option_3', title: 'Ubicación'}
      }
    ];

    await whatsappService.sendInteractiveButtons(to, menuMessage, buttons);
  }

  async handleMenuOption(to, option) {
    let response;    
    switch(option) {
        case 'option_1': //agendar
            this.appointmentState[to] = { step : 'name'}
            response = 'Por favor ingresa tu nombre y apellido:';
            break;        
        case 'option_2': //consulta
          this.assistandState[to] = { step: 'question' };
          response = "Realiza tu consulta";
          break;        
        case 'option_3': //ubicacion
            response = 'Te esperamos en nuestra sucursal.';
            await this.sendLocation(to);
            break;
        case 'option_6': //emergencia
            response = "Si esto es una emergencia, te invitamos a llamar a nuestra linea de atención"
            await this.sendContact(to);
            break;            
        default:
            response = 'Lo siento, no entendí tu selección. Por favor, elige una de las opciones del menú.';
            break;
    }
    
    await whatsappService.sendMessage(to, response);
  }

  async sendMedia(to) {
    // const mediaUrl = 'https://s3.amazonaws.com/gndx.dev/medpet-audio.aac';
    // const caption = 'Bienvenida';
    // const type = 'audio';

    // const mediaUrl = 'https://s3.amazonaws.com/gndx.dev/medpet-imagen.png';
    // const caption = '¡Esto es una Imagen!';
    // const type = 'image';

    // const mediaUrl = 'https://s3.amazonaws.com/gndx.dev/medpet-video.mp4';
    // const caption = '¡Esto es una video!';
    // const type = 'video';

    //const mediaUrl = 'https://s3.amazonaws.com/gndx.dev/medpet-file.pdf';
    const mediaUrl = 'https://s3.us-east-1.amazonaws.com/muelita.dev/muelita-file.pdf';
    const caption = '¡Esto es un PDF!';
    const type = 'document';

    await whatsappService.sendMediaMessage(to, type, mediaUrl, caption);
  }

  completeAppointment(to) {
    const appointment = this.appointmentState[to];
    delete this.appointmentState[to];

    const userData = [
      to,
      appointment.name,
      // appointment.petName,
      // appointment.petType,
      appointment.reason,
      DateTime.now().setZone('America/Lima').toISO()
      //new Date().toISOString()
    ]

    appendToSheet(userData);

    return `Gracias por agendar tu cita. 
    Resumen de tu cita:
    
    Nombre: ${appointment.name}
    Motivo: ${appointment.reason}
    
    Nos pondremos en contacto contigo pronto para confirmar la fecha y hora de tu cita.`
  }

  async handleAppointmentFlow(to, message) {
    const state = this.appointmentState[to];
    let response;

    switch (state.step) {
      case 'name':
        state.name = message;
        state.step = 'reason';
        response = '¿Cuál es el motivo de la Consulta?';
        break;
      case 'reason':
        state.reason = message;
        response = this.completeAppointment(to);
        break;
    }
    await whatsappService.sendMessage(to, response);
  }

  async handleAssistandFlow(to, message) {
    const state = this.assistandState[to];
    let response;

    const menuMessage = "¿La respuesta fue de tu ayuda?"
    const buttons = [
      { type: 'reply', reply: { id: 'option_4', title: "Si, Gracias" } },
      { type: 'reply', reply: { id: 'option_5', title: 'Hacer otra pregunta'}},
      { type: 'reply', reply: { id: 'option_6', title: 'Emergencia'}}
    ];

    if (state.step === 'question') {
      response = await openAiService(message);
    }

    delete this.assistandState[to];
    await whatsappService.sendMessage(to, response);
    await whatsappService.sendInteractiveButtons(to, menuMessage, buttons);
  }

  async sendContact(to) {
    const contact = {
      addresses: [
        {
          street: "Manuel Aguirre 133-A, Yanahuara 04013",
          city: "Arequipa",
          state: "Arequipa",
          zip: "040126",
          country: "Perú",
          country_code: "PE",
          type: "WORK"
        }
      ],
      emails: [
        {
          email: "contacto@doctormuelita.com",
          type: "WORK"
        }
      ],
      name: {
        formatted_name: "Doctor Muelita Contacto",
        first_name: "Doctor Muelita",
        last_name: "Contacto",
        middle_name: "",
        suffix: "",
        prefix: ""
      },
      org: {
        company: "Doctor Muelita",
        department: "Atención al Cliente",
        title: "Representante"
      },
      phones: [
        {
          phone: "+51941409209",
          wa_id: "51941409209",
          type: "WORK"
        }
      ],
      urls: [
        {
          url: "https://www.doctormuelita.com/",
          type: "WORK"
        }
      ]
    };

    await whatsappService.sendContactMessage(to, contact);
  }

  async sendLocation(to) {
    const latitude = -16.402127340469868;
    const longitude = -71.5468061885345;
    const name = 'Doctor Muelita';
    const address = 'Manuel Aguirre 133a, Yanahuara, Aerquipa.'

    await whatsappService.sendLocationMessage(to, latitude, longitude, name, address);
  }
  
}

export default new MessageHandler();