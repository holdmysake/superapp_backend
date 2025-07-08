import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'
import Trunkline from './trunkline.model.js'

const Spot = sequelize.define('spot', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    spot_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    spot_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    tline_id: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
            model: Trunkline,
            key: 'tline_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    },
    sort: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    is_seen: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    is_battery: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    x_axis: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    y_axis: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'spot',
    timestamps: false,
    underscored: true
})

export default Spot
