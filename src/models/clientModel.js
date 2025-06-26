class ClientModel {
    constructor(id, name, locations) {
        this.id = id;
        this.name = name;
        this.locations = locations; // Array of location objects
    }

    getClientInfo() {
        return {
            id: this.id,
            name: this.name,
            locations: this.locations
        };
    }

    addLocation(location) {
        this.locations.push(location);
    }

    removeLocation(locationId) {
        this.locations = this.locations.filter(location => location.id !== locationId);
    }
}

export default ClientModel;